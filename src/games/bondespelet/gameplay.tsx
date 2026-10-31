import { buildingPrices, buildings, cropPlantingCost, crops, cropsPerStack, playerColors, playerFieldCount, playerHarvestValue, startingMoney } from '../../../supabase/functions/_shared/games/bondespelet/game.ts';
import Board from './Board.tsx';
import type { GameSession } from './game.ts';
import { CroftPicker } from './setup.tsx';

export function GamePlay({ session }: { session: GameSession }) {
  const {
    state, selectedRegion, setSelectedRegion, busy, error, sidebarPlayers,
    rolling, userId, act, choosingCrofts, planting, current, canRoll, controlledPlayer, canPlant, canChangeBuilding, canPlay,
  } = session;
  if (!state) return null;
  const fieldCount = playerFieldCount(controlledPlayer);
  const plantedCount = controlledPlayer?.crops?.length ?? 0;
  const pendingCount = controlledPlayer?.pendingCrops ?? 0;
  const cropCost = cropPlantingCost(controlledPlayer, state.year);
  const canAffordCrop = (controlledPlayer?.money ?? startingMoney) >= cropCost;
  const canSkipPlanting = planting && plantedCount === 0 && !canAffordCrop;
  const harvestValue = playerHarvestValue(controlledPlayer);
  const selectedBuilding = buildings.find((building) => building.id === selectedRegion);
  const currentBuilding = buildings.find((building) => building.id === controlledPlayer?.croft);
  const salePrice = buildingPrices[controlledPlayer?.buildingType ?? 'croft'];
  const availableMoney = (controlledPlayer?.money ?? startingMoney) + salePrice;
  const buildingAvailable = selectedBuilding && selectedBuilding.id !== controlledPlayer?.croft &&
    !state.players.some((player) => player.id !== controlledPlayer?.id && player.croft === selectedBuilding.id);
  const harvestAvailable = state.status === 'playing' && !rolling && !choosingCrofts && !planting && state.turnRoll !== undefined &&
    (controlledPlayer?.position ?? 0) >= 55 && (controlledPlayer?.position ?? 0) <= 81 && plantedCount > 0;
  return (
    <div className="game-layout">
      <div>
        <Board players={state.players} selectedRegion={selectedRegion} onSelectRegion={setSelectedRegion} footer={
          <div className="board-footer"><span className="status-dot" /><span>{busy ? 'Saving…' : state?.lastMove ?? 'A turn-based game for friends near and far.'}</span></div>
        } />
        {planting && (state.year ?? 1) > 1 && controlledPlayer && <section className="card planted-fields" aria-label="Change building">
          <h2>Change building</h2>
          <p className="hint">Before planting, select an available croft, farm, mansion or castle on the map or in its list. Selling {currentBuilding?.name ?? 'your building'} adds {salePrice.toLocaleString('sv-SE')} kr toward the purchase. Buying the castle wins the game.</p>
          <p role="status">{selectedBuilding ? `${selectedBuilding.name} (${selectedBuilding.type}) costs ${buildingPrices[selectedBuilding.type].toLocaleString('sv-SE')} kr${buildingAvailable ? '' : selectedBuilding.id === controlledPlayer.croft ? ' — yours' : ' — taken'}.` : 'Select a building to change to, or keep your current one.'}</p>
          {selectedBuilding && buildingAvailable && availableMoney < buildingPrices[selectedBuilding.type] && <p className="hint">You need {(buildingPrices[selectedBuilding.type] - availableMoney).toLocaleString('sv-SE')} kr more after selling your building.</p>}
          <button type="button" disabled={!canChangeBuilding || !buildingAvailable || !selectedBuilding || availableMoney < buildingPrices[selectedBuilding.type]}
            onClick={() => { if (selectedBuilding) void act({ type: 'change-building', buildingId: selectedBuilding.id }); }}>Sell and buy {selectedBuilding?.name ?? 'selected building'}</button>
        </section>}
        {controlledPlayer && <section className="card planted-fields" aria-label="Player fields">
          <h2>{controlledPlayer.id === userId ? 'Your fields' : `${controlledPlayer.name}’s fields`} ({plantedCount}/{fieldCount})</h2>
          <div className="crop-fields" aria-live="polite">
            {Array.from({ length: Math.max(fieldCount, plantedCount) }, (_, index) => {
              const crop = crops.find((crop) => crop.id === controlledPlayer.crops?.[index]);
              return crop && index >= plantedCount - pendingCount
                ? <button type="button" className="crop-tile" key={index} style={{ background: crop.color }} disabled={!canPlant}
                    aria-label={`Return ${crop.name.toLowerCase()} from field ${index + 1} to the stack`}
                    onClick={() => { void act({ type: 'return-crop', fieldIndex: index }); }}>{crop.name}</button>
                : <span className="crop-tile" key={index} style={{ background: crop?.color }}>{crop?.name ?? 'Empty field'}</span>;
            })}
          </div>
          <p className="hint">{pendingCount ? 'Click newly planted fields to return crops. Confirm planting to keep them.' : !fieldCount ? 'Choose a croft to get fields.' : planting ? 'Click a crop stack when it is your turn to prepare your fields.' : 'After rolling, harvest on spaces 55–81. Plant again after the year ends.'}</p>
          {(pendingCount > 0 || canSkipPlanting) && <button type="button" disabled={!canPlant} onClick={() => { void act({ type: 'confirm-planting' }); }}>{canSkipPlanting ? 'Continue without planting' : 'Confirm planting'}</button>}
          {harvestAvailable && <button type="button" disabled={!canPlay} onClick={() => { void act({ type: 'harvest' }); }}>Harvest for {harvestValue.toLocaleString('sv-SE')} kr</button>}
        </section>}
        {error && <p className="message error" role="alert">{error}</p>}
      </div>
      <aside className="game-sidebar" aria-label="Players, dice and cards">
        <details className="card player-resources">
          <summary><h2>Player resources</h2></summary>
          <ol className="players resource-players">{sidebarPlayers.map((player) => {
            const i = state.players.indexOf(player);
            const building = buildings.find((building) => building.id === player.croft);
            return <li key={player.id} aria-current={state.status === 'playing' && !rolling && i === state.currentPlayer ? 'true' : undefined}>
            {player.id === userId ? <details className="avatar-picker">
              <summary className="avatar" aria-label="Change your color" title="Change your color" data-color={player.color ?? playerColors[i]} style={{ background: player.color ?? playerColors[i] }}>{player.name.charAt(0).toUpperCase()}</summary>
              <div className="color-options" role="group" aria-label="Choose your color">
                {playerColors.map((color) => {
                  const taken = state.players.some((p, index) => p.id !== userId && (p.color ?? playerColors[index]) === color);
                  const selected = color === (player.color ?? playerColors[i]);
                  const label = `${color.charAt(0).toUpperCase() + color.slice(1)}${taken ? ' (taken)' : ''}`;
                  return <button key={color} type="button" className="avatar" data-color={color} style={{ background: color }}
                    aria-label={label} title={label} aria-pressed={selected} disabled={busy || taken} onClick={(event) => {
                      event.currentTarget.closest('details')?.removeAttribute('open');
                      void act({ type: 'set-color', color });
                    }}>{taken ? '×' : selected ? '✓' : ''}</button>;
                })}
              </div>
            </details> : <span className="avatar" data-color={player.color ?? playerColors[i]} style={{ background: player.color ?? playerColors[i] }}>{player.name.charAt(0).toUpperCase()}</span>}
            <span className="player-name">{player.name}{player.id === userId && <small>you</small>}<small>{building ? `${building.type[0].toUpperCase() + building.type.slice(1)}: ${building.name}` : 'No building chosen'}</small>{state.status === 'playing' && !rolling && i === state.currentPlayer && <small className="turn-label">their turn</small>}</span>
            <dl className="resource-totals">
              <div><dt>Money</dt><dd>{(player.money ?? startingMoney).toLocaleString('sv-SE')} kr</dd></div>
            </dl>
            {!!player.crops?.length && <p className="player-crops">Fields: {crops.flatMap((crop) => {
              const count = player.crops!.filter((id) => id === crop.id).length;
              return count ? [`${crop.name} × ${count}`] : [];
            }).join(', ')}</p>}
          </li>; })}</ol>
        </details>
        <section className="card">
          <h2>{choosingCrofts ? 'Choose a croft' : planting ? `Preparation for year ${state.year ?? 1}` : rolling ? 'Opening rolls' : 'Turn roll'}</h2>
          {choosingCrofts ? <><CroftPicker session={session} /><p className="hint">{current?.name} chooses next.</p></> : planting ? <p className="hint">{current?.name} prepares next. {(state.year ?? 1) > 1 ? 'Change buildings before planting. Plant and confirm in order. If you cannot afford a crop, continue with empty fields.' : 'Everyone must plant at least one crop and confirm before normal turns begin.'}</p> : <>
          {rolling ? <div className="dice-tray" aria-live="polite">{sidebarPlayers.map((player) => <div className="dice-result" key={player.id}>
            <span className="dice-slot" role="img" aria-label={`${player.name}: ${player.roll ?? 'not rolled'}`}>{player.roll === undefined ? '—' : String.fromCodePoint(0x267f + player.roll)}</span>
            <small>{player.name}</small>
            {player.rolls && (player.rolls.length > 1 || player.roll === undefined) && <small>{player.rolls.join(' → ')}{player.roll === undefined ? ' → …' : ''}</small>}
          </div>)}</div> : <div className="dice-tray" aria-live="polite"><div className="dice-result">
            <span className="dice-slot" role="img" aria-label={`${current?.name}: ${state.turnRoll ?? 'not rolled'}`}>{state.turnRoll === undefined ? '—' : String.fromCodePoint(0x267f + state.turnRoll)}</span>
            <small>{current?.name}</small>
          </div></div>}
          {state.status === 'playing' && (rolling || state.turnRoll === undefined)
            ? <button disabled={!canRoll} onClick={() => { void act({ type: 'roll' }); }}>{rolling && controlledPlayer?.rolls?.length ? 'Reroll die' : 'Roll die'}</button>
            : state.status === 'playing' && <button disabled={!canPlay} onClick={() => { void act({ type: 'end-turn' }); }}>End turn</button>}
          {!rolling && <p className="hint">Roll to move your marker that many spaces. You may harvest on spaces 55–81 before ending your turn.</p>}
          </>}
          <p className="hint">{state.turnOrder
            ? `Turn order: ${state.turnOrder.map((id) => state.players.find((p) => p.id === id)?.name).join(' → ')}`
            : 'Roll in any order. Highest roll goes first. Tied players reroll before croft selection begins.'}</p>
        </section>
        <section className="card" aria-label="Crop stacks">
          <h2>Crops</h2>
          <div className="crop-stacks">
            {crops.map((crop) => {
              const remaining = cropsPerStack - state.players.reduce((count, player) => count + (player.crops ?? []).filter((id) => id === crop.id).length, 0);
              return <button key={crop.id} type="button" className="crop-stack" style={{ background: crop.color }}
                disabled={!canPlant || !canAffordCrop || remaining === 0 || plantedCount >= fieldCount} aria-label={`Plant ${crop.name.toLowerCase()}, ${cropCost.toLocaleString('sv-SE')} kr, ${remaining} remaining`}
                onClick={() => { void act({ type: 'plant', crop: crop.id }); }}>
                <span>{crop.name}</span><small>{remaining} left</small><small>{cropCost ? `${cropCost.toLocaleString('sv-SE')} kr` : 'Free'}</small>
              </button>;
            })}
          </div>
          <p className="hint">{canSkipPlanting ? 'Not enough money for a crop. Continue without planting.' : canAffordCrop ? 'Click a stack to put one crop in your fields. Returning an unconfirmed crop refunds its cost.' : 'Not enough money to plant another crop. Return an unconfirmed crop to get its cost back.'}</p>
        </section>
        <section className="card">
          <h2>Cards</h2>
          <div className="card-tray"><div className="card-slot">Draw pile</div><div className="card-slot">Discard pile</div></div>
          <p className="hint">No cards in play.</p>
        </section>
      </aside>
    </div>
  );
}
