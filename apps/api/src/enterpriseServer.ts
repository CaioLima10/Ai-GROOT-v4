export { }

process.env.GIOM_USE_TS_ROUTE_REGISTRARS ??= "true"
await import("../src/enterpriseServer.js")
