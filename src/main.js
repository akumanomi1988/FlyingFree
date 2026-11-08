import {createFlyingFreeApplication} from './runtime/app.js';

// A hot reload or repeated bootstrap must never create two RAF owners.
window.__FLYINGFREE_RUNTIME__?.dispose();
const app=createFlyingFreeApplication();
window.__FLYINGFREE_RUNTIME__=app;
app.start();
