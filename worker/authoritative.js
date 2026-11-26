import { makeBattle, applyNorthstar, northstarView } from './northstar.js';
import { makeIronRoutes, applyIronRoutes, ironRoutesView } from '../public/iron-routes-rules.js';

// Games whose state lives only in the Durable Object. Each seat receives its own view.
//   make(roundSeats) -> state
//   apply(state, seat, move) -> true when the move was legal (state is mutated in place)
//   view(state, seat) -> what that seat may see
//   finished(state) -> true once a rematch may start
export const authoritative = {
  northstar: {
    make: () => makeBattle(),
    apply: applyNorthstar,
    view: northstarView,
    finished: state => state.stage === 'finished',
  },
  iron_routes: {
    make: makeIronRoutes,
    apply: applyIronRoutes,
    view: ironRoutesView,
    finished: state => Boolean(state.over),
  },
};
