// Server wrapper that reads the beta program state and passes it to the
// client form. Splitting the read here avoids leaking BETA_PROGRAM_END_AT
// to the client bundle.

import { trialDaysForNewSignup, isBetaProgramActive } from "@/lib/beta-program";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <SignupForm
      trialDays={trialDaysForNewSignup()}
      isBeta={isBetaProgramActive()}
    />
  );
}
