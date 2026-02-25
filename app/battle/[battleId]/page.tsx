import { InteractiveBattle } from "../../interactive-battle";

export default async function BattlePage({
  params,
}: {
  params: Promise<{ battleId: string }>;
}) {
  const { battleId } = await params;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <InteractiveBattle initialBattleId={battleId} />
      </div>
    </div>
  );
}
