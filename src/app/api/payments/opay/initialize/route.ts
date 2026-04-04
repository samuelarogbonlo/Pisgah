import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requirePatientSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  billingRecords,
  diagnosticOrders,
  facilities,
  hospitals,
  hospitalPaymentSettings,
  patients,
  paymentTransactions,
} from "@/lib/db/schema";
import {
  createOpayCashierPayment,
  toMinorUnits,
} from "@/lib/payments/opay";
import { generatePaymentReference } from "@/lib/payments/reference";

type InitializeBody = {
  orderId?: string;
};

export async function POST(request: Request) {
  try {
    const patientSession = await requirePatientSession();
    const body = (await request.json().catch(() => ({}))) as InitializeBody;
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const [record] = await db
      .select({
        orderId: diagnosticOrders.id,
        orderStatus: diagnosticOrders.status,
        patientId: diagnosticOrders.patientId,
        testType: diagnosticOrders.testType,
        billingId: billingRecords.id,
        billingStatus: billingRecords.status,
        amount: billingRecords.amount,
        hospitalId: hospitals.id,
        hospitalName: hospitals.name,
        opayEnabled: hospitalPaymentSettings.opayEnabled,
        opayMerchantId: hospitalPaymentSettings.opayMerchantId,
        patientName: patients.name,
        patientEmail: patients.email,
        patientPhone: patients.phone,
      })
      .from(diagnosticOrders)
      .innerJoin(billingRecords, eq(billingRecords.orderId, diagnosticOrders.id))
      .innerJoin(patients, eq(diagnosticOrders.patientId, patients.id))
      .innerJoin(facilities, eq(diagnosticOrders.facilityId, facilities.id))
      .innerJoin(hospitals, eq(facilities.hospitalId, hospitals.id))
      .innerJoin(
        hospitalPaymentSettings,
        eq(hospitalPaymentSettings.hospitalId, hospitals.id),
      )
      .where(
        and(
          eq(diagnosticOrders.id, orderId),
          eq(diagnosticOrders.patientId, patientSession.patientId),
        ),
      )
      .limit(1);

    if (!record) {
      return NextResponse.json({ error: "Order is not available" }, { status: 404 });
    }

    if (record.orderStatus !== "AWAITING_PAYMENT" || record.billingStatus !== "unpaid") {
      return NextResponse.json(
        { error: "This bill is no longer awaiting payment" },
        { status: 409 },
      );
    }

    if (!record.opayEnabled || !record.opayMerchantId) {
      return NextResponse.json(
        { error: "OPay is not enabled for this hospital" },
        { status: 409 },
      );
    }

    const reference = generatePaymentReference("opay");

    await db.insert(paymentTransactions).values({
      hospitalId: record.hospitalId,
      billingRecordId: record.billingId,
      orderId: record.orderId,
      provider: "opay",
      providerReference: reference,
      amount: record.amount,
      currency: "NGN",
      status: "initialized",
    });

    const payment = await createOpayCashierPayment({
      merchantId: record.opayMerchantId,
      reference,
      amountMinorUnits: toMinorUnits(record.amount),
      productName: record.testType,
      productDescription: `${record.patientName} · ${record.hospitalName}`,
      returnTo: "/mini",
      customer: {
        userId: record.orderId,
        userName: record.patientName,
        userMobile: record.patientPhone,
        userEmail: record.patientEmail,
      },
    });

    await db
      .update(paymentTransactions)
      .set({
        providerPaymentId: payment.orderNo,
        checkoutUrl: payment.cashierUrl,
        providerPayload: payment.raw,
        status: payment.cashierUrl ? "pending" : "failed",
        failureReason: payment.cashierUrl ? null : "missing-cashier-url",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentTransactions.provider, "opay"),
          eq(paymentTransactions.providerReference, reference),
        ),
      );

    if (!payment.cashierUrl) {
      return NextResponse.json(
        { error: "OPay did not return a checkout URL" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      reference,
      cashierUrl: payment.cashierUrl,
      orderNo: payment.orderNo,
    });
  } catch (error) {
    console.error("[payments/opay/initialize]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to initialize OPay checkout",
      },
      { status: 500 },
    );
  }
}
