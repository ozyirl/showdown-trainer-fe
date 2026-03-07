import { UserButton } from "@clerk/nextjs";
import { InteractiveBattle } from "../../interactive-battle";

export default async function BattlePage({
  params,
}: {
  params: Promise<{ battleId: string }>;
}) {
  const { battleId } = await params;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex justify-end">
          <UserButton afterSignOutUrl="/" />
        </div>
        <InteractiveBattle initialBattleId={battleId} />
      </div>
    </div>
  );
}
