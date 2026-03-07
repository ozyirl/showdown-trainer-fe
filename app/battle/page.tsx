import { UserButton } from "@clerk/nextjs";
import { InteractiveBattle } from "../interactive-battle";

export default function BattlePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex justify-end">
          <UserButton afterSignOutUrl="/" />
        </div>
        <InteractiveBattle />
      </div>
    </div>
  );
}
