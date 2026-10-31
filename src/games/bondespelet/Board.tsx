import { useRef, useState, type ReactNode } from 'react';
import { boardSpaceCount, buildings, playerColors } from '../../../supabase/functions/_shared/games/bondespelet/game.ts';
import type { Player } from '../../../supabase/functions/_shared/games/bondespelet/game.ts';

// Space 1 is at the bottom left; numbering continues around the calendar.
const track = Array.from({ length: boardSpaceCount }, (_, i) => {
  const step = i % 27;
  if (i < 27) return { x: 127 + step * 18.46, y: 566 };
  if (i < 54) return { x: 702, y: 539 - step * 18.46 };
  if (i < 81) return { x: 607 - step * 18.46, y: 35 };
  return { x: 29, y: 59 + step * 18.46 };
});

// Final region shapes in the embedded 734 × 600 board artwork.
const regions = [
  {
    color: '#ef4444',
    boundaries: ['M44 50H204 C199 74 200 107 206 137 C209 172 220 198 226 220 C230 237 221 261 221 281 L220 337 C204 342 181 341 158 336 L132 330 C116 325 103 320 90 311 C77 302 61 293 44 283Z'],
    path: 'M44 50H204 C199 74 200 107 206 137 C209 172 220 198 226 220 C230 237 221 261 221 281 L220 337 C204 342 181 341 158 336 L132 330 C116 325 103 320 90 311 C77 302 61 293 44 283Z M44 50H147 L147 67 L127 67 L114 73 L104 73 L101 85 L98 101 L100 122 L103 130 L98 141 L92 148 C93 161 100 169 98 184 L111 186 L134 185 L151 187 L174 183 L194 182 L214 177 L220 190 L196 194 L169 195 L144 196 L120 194 L99 197 L89 205 L94 218 L87 229 L92 243 L88 254 L98 266 L105 281 L114 291 L121 311 L132 330 L90 326 L44 300Z M147 50H220V177H214 L194 182 L174 183 L151 187 L134 185 L111 186 L98 184 C100 169 93 161 92 148 L98 141 L103 130 L100 122 L98 101 L101 85 L104 73 L114 73 L127 67 L147 67Z',
  },
  {
    color: '#f97316',
    boundaries: ['M204 50H307 C307 100 302 153 298 199 L300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 C429 344 430 371 431 394 L430 444 L311 448 C312 426 310 405 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337 L221 281 C221 261 230 237 226 220 C220 198 209 172 206 137 C200 107 199 74 204 50Z'],
    path: 'M204 50H307 C307 100 302 153 298 199 L300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 C429 344 430 371 431 394 L430 444 L311 448 C312 426 310 405 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337 L221 281 C221 261 230 237 226 220 C220 198 209 172 206 137 C200 107 199 74 204 50Z M213 138 C230 133 241 146 252 142 C271 140 283 136 302 141 L298 199 L300 223 C299 237 292 245 293 255 L290 270 L284 278.5 L277 274 L263 272 L246 269 L225 284 L214 273 L210 200Z M200 50H310V141H302 C283 136 271 140 252 142 C241 146 230 133 213 138 H200Z M300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 L431 358 L424 357 L415 355 L409 358 L396 357 L384 361 L373 349 L360 346 L350 326 L335 321 L322 307 L301 300 L291 283 L284 278.5 L290 270 L293 255 C292 245 299 237 300 223Z M220 337 L225 284 L246 269 L263 272 L277 274 L284 278.5 L291 283 L301 300 L316 308 L326 313 L339 319 L344 328 L335 329 L326 326 L318 331 L315 337 L310 341 L311 349 L316 355 L322 356 L323 363 L334 369 L335 379 L341 391 C332 397 321 402 308 406 C307 399 305 393 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337Z M301 300 L322 307 L335 321 L350 326 L360 346 L373 349 L384 361 L378 367 L371 373 L373 381 L368 389 L365 397 L357 397 L350 394 L345 391 L341 391 L335 379 L334 369 L323 363 L322 356 L316 355 L311 349 L310 341 L315 337 L318 331 L326 326 L335 329 L344 328 L339 319 L326 313 L316 308Z',
  },
  {
    color: '#eab308',
    boundaries: ['M307 50H459 C461 95 469 135 489 166 C500 180 514 190 532 197 C512 228 489 249 461 276 C449 291 439 309 433 325 C410 312 385 296 366 283 C353 269 342 255 329 247 C314 237 303 234 300 223 L298 199 C302 153 307 100 307 50Z'],
    path: 'M307 50H459 C461 95 469 135 489 166 C500 180 514 190 532 197 C512 228 489 249 461 276 C449 291 439 309 433 325 C410 312 385 296 366 283 C353 269 342 255 329 247 C314 237 303 234 300 223 L298 199 C302 153 307 100 307 50Z M416 50H459 L462 105 L477 143 L466 151 L451 140 L442 133 L429 137 L419 132 L405 139 L394 135 L381 144 L370 160 L366 180 L359 209 L373 228 L390 246 L412 261 L435 281 L442 300 L440 330 L420 330 L366 283 L329 247 L295 230 L295 150 H301 C318 141 333 149 348 141 L365 134 L383 123 L397 115 L402 93 L410 79Z M307 50H416 L410 79 L402 93 L397 115 L383 123 L365 134 L348 141 C333 149 318 141 301 150 H295V50Z',
  },
  {
    color: '#22c55e',
    boundaries: ['M459 50H690V207 C638 227 580 224 532 197 C514 190 500 180 489 166 C469 135 461 95 459 50Z'],
    path: 'M459 50H690V207 C638 227 580 224 532 197 C514 190 500 180 489 166 C469 135 461 95 459 50Z M450 50H526 L521 59 L525 65 L519 71 L528 73 L537 77 L542 86 L539 94 L542 103 L534 111 L522 117 L509 115 L501 120 L498 129 L489 135 L478 133 L465 128 L450 110Z',
  },
  {
    color: '#06b6d4',
    boundaries: ['M532 197 C580 224 638 227 690 207 V450 C651 450 620 438 582 430 C550 425 525 426 511 423 C481 419 455 398 431 394 C430 371 429 344 433 325 C439 309 449 291 461 276 C489 249 512 228 532 197Z'],
    path: 'M532 197 C580 224 638 227 690 207 V450 C651 450 620 438 582 430 C550 425 525 426 511 423 C481 419 455 398 431 394 C430 371 429 344 433 325 C439 309 449 291 461 276 C489 249 512 228 532 197Z M700 281 L690 281 C674 277 663 287 650 280 C638 272 625 283 614 278 C602 274 596 289 587 285 L588 301 L581 315 L587 326 L580 338 L585 350 L582 361 L586 377 L581 389 L585 406 L580 419 L582 430 L620 448 L700 460Z',
  },
  {
    color: '#3b82f6',
    boundaries: ['M44 283 C61 293 77 302 90 311 C103 320 116 325 132 330 C138 348 129 365 113 373 L100 384 L96 389 L86 393 L84 398 L77 402 L68 404 L60 410 L51 416 L44 419Z'],
    path: 'M44 283 C61 293 77 302 90 311 C103 320 116 325 132 330 C138 348 129 365 113 373 L100 384 L96 389 L86 393 L84 398 L77 402 L68 404 L60 410 L51 416 L44 419Z',
  },
  {
    color: '#a855f7',
    boundaries: ['M132 330 L158 336 C181 341 204 342 220 337 C228 336 235 334 244 335 C274 333 291 355 303 387 C310 405 312 426 311 448 V552 H44 V419 L51 416 L60 410 L68 404 L77 402 L84 398 L86 393 L96 389 L100 384 L113 373 C129 365 138 348 132 330Z'],
    path: 'M132 330 L158 336 C181 341 204 342 220 337 C228 336 235 334 244 335 C274 333 291 355 303 387 C310 405 312 426 311 448 V552 H44 V419 L51 416 L60 410 L68 404 L77 402 L84 398 L86 393 L96 389 L100 384 L113 373 C129 365 138 348 132 330Z M311 466 C299 458 290 468 278 459 C264 452 256 457 246 449 C230 439 222 445 212 445 C199 445 202 455 188 457 C177 463 178 472 165 477 C153 484 146 490 140 503 L130 511 L136 527 L141 539 L143 560 H363 L365 544 L357 533 C355 523 363 511 359 495 C350 493 352 480 340 480 C330 481 327 468 311 470Z',
  },
  {
    color: '#ec4899',
    boundaries: ['M311 448 L430 444 C429 480 421 515 416 552 H311Z'],
    path: 'M311 448 L430 444 C429 480 421 515 416 552 H311Z M311 466 C299 458 290 468 278 459 C264 452 256 457 246 449 C230 439 222 445 212 445 C199 445 202 455 188 457 C177 463 178 472 165 477 C153 484 146 490 140 503 L130 511 L136 527 L141 539 L143 560 H363 L365 544 L357 533 C355 523 363 511 359 495 C350 493 352 480 340 480 C330 481 327 468 311 470Z',
  },
  {
    color: '#84cc16',
    boundaries: ['M431 394 C455 398 481 419 511 423 C505 461 499 507 498 552 H416 C421 515 429 480 430 444Z'],
    path: 'M431 394 C455 398 481 419 511 423 C505 461 499 507 498 552 H416 C421 515 429 480 430 444Z M410 505H416 C432 496 440 503 451 499 C469 492 483 508 500 507 L500 513 C513 503 524 515 537 512 C552 504 562 519 576 517 C587 519 592 526 606 520 C619 512 628 528 642 529 C660 526 671 539 690 535 H700V560H410Z',
  },
  {
    color: '#14b8a6',
    boundaries: ['M511 423 C525 426 550 425 582 430 C620 438 651 450 690 450 V552 H498 C499 507 505 461 511 423Z'],
    path: 'M511 423 C525 426 550 425 582 430 C620 438 651 450 690 450 V552 H498 C499 507 505 461 511 423Z M410 505H416 C432 496 440 503 451 499 C469 492 483 508 500 507 L500 513 C513 503 524 515 537 512 C552 504 562 519 576 517 C587 519 592 526 606 520 C619 512 628 528 642 529 C660 526 671 539 690 535 H700V560H410Z',
  },
  {
    color: '#0f766e',
    boundaries: ['M44 50H204 C199 74 200 107 206 137 C209 172 220 198 226 220 C230 237 221 261 221 281 L220 337 C204 342 181 341 158 336 L132 330 C116 325 103 320 90 311 C77 302 61 293 44 283Z'],
    path: 'M44 50H147 L147 67 L127 67 L114 73 L104 73 L101 85 L98 101 L100 122 L103 130 L98 141 L92 148 C93 161 100 169 98 184 L111 186 L134 185 L151 187 L174 183 L194 182 L214 177 L220 190 L196 194 L169 195 L144 196 L120 194 L99 197 L89 205 L94 218 L87 229 L92 243 L88 254 L98 266 L105 281 L114 291 L121 311 L132 330 L90 326 L44 300Z',
  },
  {
    color: '#f472b6',
    boundaries: ['M44 50H204 C199 74 200 107 206 137 C209 172 220 198 226 220 C230 237 221 261 221 281 L220 337 C204 342 181 341 158 336 L132 330 C116 325 103 320 90 311 C77 302 61 293 44 283Z'],
    path: 'M147 50H220V177H214 L194 182 L174 183 L151 187 L134 185 L111 186 L98 184 C100 169 93 161 92 148 L98 141 L103 130 L100 122 L98 101 L101 85 L104 73 L114 73 L127 67 L147 67Z',
  },
  {
    color: '#4f46e5',
    boundaries: ['M204 50H307 C307 100 302 153 298 199 L300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 C429 344 430 371 431 394 L430 444 L311 448 C312 426 310 405 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337 L221 281 C221 261 230 237 226 220 C220 198 209 172 206 137 C200 107 199 74 204 50Z'],
    path: 'M213 138 C230 133 241 146 252 142 C271 140 283 136 302 141 L298 199 L300 223 C299 237 292 245 293 255 L290 270 L284 278.5 L277 274 L263 272 L246 269 L225 284 L214 273 L210 200Z',
  },
  {
    color: '#fbbf24',
    boundaries: ['M204 50H307 C307 100 302 153 298 199 L300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 C429 344 430 371 431 394 L430 444 L311 448 C312 426 310 405 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337 L221 281 C221 261 230 237 226 220 C220 198 209 172 206 137 C200 107 199 74 204 50Z'],
    path: 'M200 50H310V141H302 C283 136 271 140 252 142 C241 146 230 133 213 138 H200Z',
  },
  {
    color: '#be123c',
    boundaries: ['M307 50H459 C461 95 469 135 489 166 C500 180 514 190 532 197 C512 228 489 249 461 276 C449 291 439 309 433 325 C410 312 385 296 366 283 C353 269 342 255 329 247 C314 237 303 234 300 223 L298 199 C302 153 307 100 307 50Z'],
    path: 'M416 50H459 L462 105 L477 143 L466 151 L451 140 L442 133 L429 137 L419 132 L405 139 L394 135 L381 144 L370 160 L366 180 L359 209 L373 228 L390 246 L412 261 L435 281 L442 300 L440 330 L420 330 L366 283 L329 247 L295 230 L295 150 H301 C318 141 333 149 348 141 L365 134 L383 123 L397 115 L402 93 L410 79Z',
  },
  {
    color: '#38bdf8',
    boundaries: ['M307 50H459 C461 95 469 135 489 166 C500 180 514 190 532 197 C512 228 489 249 461 276 C449 291 439 309 433 325 C410 312 385 296 366 283 C353 269 342 255 329 247 C314 237 303 234 300 223 L298 199 C302 153 307 100 307 50Z'],
    path: 'M307 50H416 L410 79 L402 93 L397 115 L383 123 L365 134 L348 141 C333 149 318 141 301 150 H295V50Z',
  },
  {
    color: '#a16207',
    boundaries: ['M532 197 C580 224 638 227 690 207 V450 C651 450 620 438 582 430 C550 425 525 426 511 423 C481 419 455 398 431 394 C430 371 429 344 433 325 C439 309 449 291 461 276 C489 249 512 228 532 197Z'],
    path: 'M700 281 L690 281 C674 277 663 287 650 280 C638 272 625 283 614 278 C602 274 596 289 587 285 L588 301 L581 315 L587 326 L580 338 L585 350 L582 361 L586 377 L581 389 L585 406 L580 419 L582 430 L620 448 L700 460Z',
  },
  {
    color: '#6366f1',
    boundaries: ['M132 330 L158 336 C181 341 204 342 220 337 C228 336 235 334 244 335 C274 333 291 355 303 387 C310 405 312 426 311 448 V552 H44 V419 L51 416 L60 410 L68 404 L77 402 L84 398 L86 393 L96 389 L100 384 L113 373 C129 365 138 348 132 330Z', 'M311 448 L430 444 C429 480 421 515 416 552 H311Z'],
    path: 'M311 466 C299 458 290 468 278 459 C264 452 256 457 246 449 C230 439 222 445 212 445 C199 445 202 455 188 457 C177 463 178 472 165 477 C153 484 146 490 140 503 L130 511 L136 527 L141 539 L143 560 H363 L365 544 L357 533 C355 523 363 511 359 495 C350 493 352 480 340 480 C330 481 327 468 311 470Z',
  },
  {
    color: '#db2777',
    boundaries: ['M431 394 C455 398 481 419 511 423 C505 461 499 507 498 552 H416 C421 515 429 480 430 444Z', 'M511 423 C525 426 550 425 582 430 C620 438 651 450 690 450 V552 H498 C499 507 505 461 511 423Z'],
    path: 'M410 505H416 C432 496 440 503 451 499 C469 492 483 508 500 507 L500 513 C513 503 524 515 537 512 C552 504 562 519 576 517 C587 519 592 526 606 520 C619 512 628 528 642 529 C660 526 671 539 690 535 H700V560H410Z',
  },
  {
    color: '#c026d3',
    boundaries: ['M204 50H307 C307 100 302 153 298 199 L300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 C429 344 430 371 431 394 L430 444 L311 448 C312 426 310 405 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337 L221 281 C221 261 230 237 226 220 C220 198 209 172 206 137 C200 107 199 74 204 50Z'],
    path: 'M300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 L431 358 L424 357 L415 355 L409 358 L396 357 L384 361 L373 349 L360 346 L350 326 L335 321 L322 307 L301 300 L291 283 L284 278.5 L290 270 L293 255 C292 245 299 237 300 223Z',
  },
  {
    color: '#0d9488',
    boundaries: ['M204 50H307 C307 100 302 153 298 199 L300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 C429 344 430 371 431 394 L430 444 L311 448 C312 426 310 405 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337 L221 281 C221 261 230 237 226 220 C220 198 209 172 206 137 C200 107 199 74 204 50Z'],
    path: 'M220 337 L225 284 L246 269 L263 272 L277 274 L284 278.5 L291 283 L301 300 L316 308 L326 313 L339 319 L344 328 L335 329 L326 326 L318 331 L315 337 L310 341 L311 349 L316 355 L322 356 L323 363 L334 369 L335 379 L341 391 C332 397 321 402 308 406 C307 399 305 393 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337Z',
  },
  {
    color: '#64748b',
    boundaries: ['M204 50H307 C307 100 302 153 298 199 L300 223 C303 234 314 237 329 247 C342 255 353 269 366 283 C385 296 410 312 433 325 C429 344 430 371 431 394 L430 444 L311 448 C312 426 310 405 303 387 C291 355 274 333 244 335 C235 334 228 336 220 337 L221 281 C221 261 230 237 226 220 C220 198 209 172 206 137 C200 107 199 74 204 50Z'],
    path: 'M301 300 L322 307 L335 321 L350 326 L360 346 L373 349 L384 361 L378 367 L371 373 L373 381 L368 389 L365 397 L357 397 L350 394 L345 391 L341 391 L335 379 L334 369 L323 363 L322 356 L316 355 L311 349 L310 341 L315 337 L318 331 L326 326 L335 329 L344 328 L339 319 L326 313 L316 308Z',
  },
  {
    color: '#7c3aed',
    boundaries: ['M459 50H690V207 C638 227 580 224 532 197 C514 190 500 180 489 166 C469 135 461 95 459 50Z'],
    path: 'M450 50H526 L521 59 L525 65 L519 71 L528 73 L537 77 L542 86 L539 94 L542 103 L534 111 L522 117 L509 115 L501 120 L498 129 L489 135 L478 133 L465 128 L450 110Z',
  },
].map((area, id) => ({ ...area, id }));

const regionGroups: { title: string; description?: string; entries: [number, string, string?][] }[] = [
  { title: 'Crofts', description: '50 000', entries: buildings.filter((b) => b.type === 'croft').map(({ id, name }) => [id, name]) },
  { title: 'Farms', description: '200 000', entries: buildings.filter((b) => b.type === 'farm').map(({ id, name }) => [id, name]) },
  { title: 'Mansions', description: '750 000', entries: buildings.filter((b) => b.type === 'mansion').map(({ id, name }) => [id, name]) },
  { title: 'Castle', description: '2,5 miljoner', entries: buildings.filter((b) => b.type === 'castle').map(({ id, name }) => [id, name]) },
  { title: 'Forests', entries: [
    [10, 'Tallheden', '100 000'], [12, 'Granliden', '50 000'],
    [14, 'Björkdungen', '100 000'], [22, 'Eklunden', '80 000'],
    [5, 'Lillskogen', '60 000'], [19, 'Storskogen', '50 000'],
    [21, 'Trollskogen', '40 000'], [16, 'Mossgläntan', '150 000'],
    [17, 'Norråsen', '150 000'], [18, 'Söderhult', '60 000'],
  ] },
];

const regionNames = new Map(regionGroups.flatMap(({ entries }) => entries.map(([id, name]) => [id, name] as const)));

export default function Board({ players, footer, selectedRegion: selected = null, onSelectRegion: setSelected }: {
  players: Player[]; footer?: ReactNode; selectedRegion?: number | null; onSelectRegion?: (id: number | null) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const regionList = useRef<HTMLDivElement>(null);
  const buildingOwners = new Map(players.map((player, i) => [player.croft, {
    name: player.name, color: player.color ?? playerColors[i],
  }]));
  const highlightRegion = (id: number) => {
    setHovered(id);
    const list = regionList.current;
    const button = list?.querySelector(`[data-region="${id}"]`);
    if (!list || !button) return;
    const bounds = list.getBoundingClientRect();
    const { top, bottom } = button.getBoundingClientRect();
    if (top < bounds.top) list.scrollTop += Math.floor(top - bounds.top);
    else if (bottom > bounds.bottom) list.scrollTop += Math.ceil(bottom - bounds.bottom);
  };
  return (
    <div className="board-with-regions">
      <aside className="region-sidebar" aria-label="Områden">
        <div className="region-list" ref={regionList}>
          {regionGroups.map(({ title, description, entries }) => (
            <div key={title}>
              {title && <h3>{title}</h3>}
              {entries.map(([id, name, areaDescription]) => {
                const owner = buildingOwners.get(id);
                return <div key={id}>
                  <button type="button" data-region={id} aria-pressed={selected === id}
                    aria-expanded={selected === id} aria-controls={`region-info-${id}`}
                    data-highlighted={hovered === id}
                    onClick={() => setSelected?.(selected === id ? null : id)}
                    onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}>
                    {owner && <span className="croft-owner" style={{ background: owner.color }}
                      role="img" aria-label={`${owner.name}'s building (${owner.color})`} title={`${owner.name} (${owner.color})`} />}
                    {name}
                  </button>
                  <p id={`region-info-${id}`} className="region-info" hidden={selected !== id}>{areaDescription ?? description}</p>
                </div>;
              })}
            </div>
          ))}
        </div>
      </aside>
    <section className="board-panel" aria-label="Game board">
      <div className="panel-heading"><span>The farm</span><span>Follow the numbered white spaces</span></div>
    <svg className="board" viewBox="0 0 800 580" role="group" aria-label="Game board with player markers on numbered spaces">
      <image href="/board.svg" width="800" height="580" />
      {/* Match the embedded artwork's centered aspect ratio inside board.svg. */}
      <g transform="translate(45.233333 0) scale(0.966667)">
        <defs>
          {regions.map((area) => (
            <clipPath key={area.id} id={`region-boundary-${area.id}`}>
              {area.boundaries.map((path, index) => <path key={index} d={path} />)}
            </clipPath>
          ))}
        </defs>
        {regions.map(({ id, ...area }) => {
          const owner = buildingOwners.get(id);
          return <g key={id} clipPath={`url(#region-boundary-${id})`} className="field" role="button"
            aria-label={`${regionNames.get(id)}${owner ? `, ${owner.name}'s building (${owner.color})` : ''}`}
            data-owned={Boolean(owner)}
            aria-pressed={selected === id} tabIndex={0}
            data-highlighted={hovered === id}
            onMouseEnter={() => highlightRegion(id)} onMouseLeave={() => setHovered(null)}
            onFocus={() => highlightRegion(id)} onBlur={() => setHovered(null)}
            onClick={() => setSelected?.(id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelected?.(id);
              }
            }}>
            <path d={area.path} fill={area.color} style={owner ? { fill: owner.color } : undefined} fillRule="evenodd" />
          </g>;
        })}
        {players.map((player, i) => {
          const position = player.position ?? 0;
          const { x, y } = position === 0 ? { x: 108.54, y: 566 } : position > boardSpaceCount ? { x: 29, y: 566 } : track[position - 1];
          const sharing = players.filter((p) => (p.position ?? 0) === position);
          const slot = sharing.indexOf(player);
          const color = player.color ?? playerColors[i];
          return <circle key={player.id} cx={x + (sharing.length > 1 ? (slot % 2 ? 4.5 : -4.5) : 0)}
            cy={y + (sharing.length > 1 ? (slot < 2 ? -4.5 : 4.5) : 0)} r={sharing.length > 1 ? 4 : 6}
            fill={color} stroke={color === 'black' ? 'white' : '#172d22'} strokeWidth="1.5"
            role="img" aria-label={`${player.name}, ${color} marker, space ${position}`}>
            <title>{`${player.name}: space ${position}`}</title>
          </circle>;
        })}
      </g>
    </svg>
      {footer}
    </section>
    </div>
  );
}
