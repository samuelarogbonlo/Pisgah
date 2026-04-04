import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifySiweMessage } from "@worldcoin/minikit-js/siwe";
import { db } from "@/lib/db";
import { patientClaims, patients } from "@/lib/db/schema";
import { consumePatientClaimWallet } from "@/lib/patients/claims";
import { setPatientSession } from "@/lib/auth/session";

const PATIENT_AUTH_NONCE_COOKIE = "pisgah_patient_auth_nonce";

type WalletAuthPayload = {
  address: string;
  message: string;
  signature: string;
  version?: number;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const nonce = cookieStore.get(PATIENT_AUTH_NONCE_COOKIE)?.value;
    if (!nonce) {
      return NextResponse.json({ error: "Missing patient auth nonce" }, { status: 400 });
    }

    const body = (await request.json()) as {
      claimToken?: string;
      walletAuth?: WalletAuthPayload;
    };

    if (!body.claimToken || !body.walletAuth) {
      return NextResponse.json({ error: "Missing claim token or wallet auth payload" }, { status: 400 });
    }

    const verification = await verifySiweMessage(
      body.walletAuth,
      nonce,
      "Sign in to Pisgah inside World App",
    );

    if (!verification.isValid) {
      return NextResponse.json({ error: "Wallet auth verification failed" }, { status: 401 });
    }

    const now = new Date();
    const [claim] = await db
      .select({
        id: patientClaims.id,
        patientId: patientClaims.patientId,
        claimedAt: patientClaims.claimedAt,
        claimedByWallet: patientClaims.claimedByWallet,
        expiresAt: patientClaims.expiresAt,
      })
      .from(patientClaims)
      .where(eq(patientClaims.token, body.claimToken))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: "Claim link not found" }, { status: 404 });
    }

    if (claim.expiresAt < now) {
      return NextResponse.json({ error: "Claim link has expired" }, { status: 410 });
    }

    if (claim.claimedByWallet && claim.claimedByWallet !== body.walletAuth.address) {
      return NextResponse.json(
        { error: "This claim link has already been used with another wallet" },
        { status: 409 },
      );
    }

    if (!claim.claimedAt) {
      await consumePatientClaimWallet({
        claimId: claim.id,
        walletAddress: body.walletAuth.address,
      });
    }

    await db
      .update(patients)
      .set({ walletAddress: body.walletAuth.address })
      .where(eq(patients.id, claim.patientId));

    const response = NextResponse.json({
      success: true,
      patientId: claim.patientId,
      walletAddress: body.walletAuth.address,
    });

    await setPatientSession(response.cookies, {
      sub: claim.patientId,
      patientId: claim.patientId,
      walletAddress: body.walletAuth.address,
      claimId: claim.id,
    });

    response.cookies.delete(PATIENT_AUTH_NONCE_COOKIE);
    return response;
  } catch (error) {
    console.error("[auth/wallet-verify]", error);
    return NextResponse.json({ error: "Unable to verify patient wallet auth" }, { status: 500 });
  }
}
