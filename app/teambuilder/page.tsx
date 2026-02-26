import { auth } from "@clerk/nextjs/server";
import TeambuilderClient from "@/app/teambuilder/TeambuilderClient";

export const dynamic = "force-dynamic";

export default async function TeamBuilderPage() {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: "/teambuilder" });
  }

  return <TeambuilderClient />;
}
