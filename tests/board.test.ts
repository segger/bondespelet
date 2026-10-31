import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Board from '../src/games/bondespelet/Board.tsx';
import type { Player } from '../supabase/functions/_shared/games/bondespelet/game.ts';

test('colored markers remain distinct when all four players share a space', () => {
  const players: Player[] = ['black', 'red', 'yellow', 'white'].map((color, i) => ({
    id: `p${i}`, name: `Farmer ${i}`, score: 0, color: color as Player['color'], position: 28,
  }));
  const markup = renderToStaticMarkup(createElement(Board, { players }));
  const markers = [...markup.matchAll(/<circle[^>]+>/g)].map(([circle]) => circle);
  assert.equal(markers.length, 4);
  assert.equal(new Set(markers.map((circle) => circle.match(/cx="[^"]+" cy="[^"]+"/)![0])).size, 4);
  for (const player of players) {
    assert.ok(markup.includes(`fill="${player.color}"`));
    assert.ok(markup.includes(`aria-label="${player.name}, ${player.color} marker, space 28"`));
  }
});

test('new and previously saved players start at 0 before space 1 with their fallback color', () => {
  for (const position of [0, undefined]) {
    const markup = renderToStaticMarkup(createElement(Board, {
      players: [{ id: 'p0', name: 'Astrid', score: 0, position }],
    }));
    assert.ok(markup.includes('aria-label="Astrid, black marker, space 0"'));
    assert.ok(markup.includes('cx="108.54" cy="566"'));
  }
});

test('finished markers appear one step after 108', () => {
  const markup = renderToStaticMarkup(createElement(Board, {
    players: [{ id: 'p0', name: 'Astrid', score: 0, position: 109 }],
  }));
  assert.ok(markup.includes('aria-label="Astrid, black marker, space 109"'));
  assert.ok(markup.includes('cx="29" cy="566"'));
});
