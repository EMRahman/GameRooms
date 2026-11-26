import { makeBattle, applyNorthstar, northstarView } from './northstar.js';
import { makeIronRoutes, applyIronRoutes, ironRoutesView, endIronRoutes } from '../public/iron-routes-rules.js';
import { makeLandlord, applyLandlord, landlordView, endLandlord } from '../public/landlord-rules.js';
import { makeConquest, applyConquest, conquestView, endConquest } from '../public/conquest-rules.js';

// Games whose state lives only in the Durable Object. Each seat receives its own view.
//   make(roundSeats, options) -> state
//   apply(state, seat, move) -> true when the move was legal (state is mutated in place)
//   view(state, seat) -> what that seat may see
//   finished(state) -> true once a rematch may start
//   end(state) -> scores an unfinished game now; the room calls it at its move limit.
//     Northstar has none because a battle cannot come near the limit.
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
    end: endIronRoutes,
  },
  landlord: {
    make: makeLandlord,
    apply: applyLandlord,
    view: landlordView,
    finished: state => Boolean(state.over),
    end: endLandlord,
  },
  conquest: {
    make: makeConquest,
    apply: applyConquest,
    view: conquestView,
    finished: state => Boolean(state.over),
    end: endConquest,
  },
};
