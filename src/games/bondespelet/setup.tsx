import type { GameSession } from './game.ts';

export function CroftPicker({ session }: { session: GameSession }) {
  const { state, controlledPlayer, choosingCrofts, current, selectedCroft, canChooseCroft, act } = session;
  return state && controlledPlayer && choosingCrofts && <>
    <p className="hint">Click an available croft on the map or in the left sidebar, then confirm your choice.</p>
    {current?.id === controlledPlayer.id && <>
      <p role="status">{selectedCroft ? `Selected: ${selectedCroft.name}` : 'Select an available croft.'}</p>
      <button disabled={!canChooseCroft || !selectedCroft} onClick={() => {
        if (canChooseCroft && selectedCroft) void act({ type: 'select-croft', croftId: selectedCroft.id });
      }}>Confirm {selectedCroft?.name ?? 'croft'}</button>
    </>}
  </>;
}

export function BondespeletRules() {
  return (
    <section className="rules"><p className="eyebrow">A SIMPLE SEASON</p><h2>How to play</h2><p>First roll to decide turn order, highest to lowest; tied players reroll. In turn order, choose a croft, plant at least one crop, and confirm planting before the next player chooses a croft. This preparation happens once per game. Everyone must finish planting before normal turns begin. Markers start at 0, before space 1. On your turn, roll a six-sided die and move your colored marker that many numbered white spaces. Move past 108 to finish the year, then wait for everyone else. Landing on 108 does not finish the year. The next year follows finish order: markers reset to 0, old crops return to the stacks, and everyone plants and confirms before rolling again. Before planting, you may sell your building and buy an available one. Crofts cost 50,000 kr, farms 200,000 kr, and mansions 750,000 kr; your old building sells for its listed price. Buying the castle for 2,500,000 kr wins the game. Initial planting is free; at year shifts, each crop costs 1,000 kr for a croft, 3,000 kr for a farm, or 10,000 kr for a mansion. Returning an unconfirmed crop refunds its cost. If you cannot afford a crop, you can continue with empty fields. End your turn after moving.</p><p>No rush. Everyone can play in their own time.</p></section>
  );
}
