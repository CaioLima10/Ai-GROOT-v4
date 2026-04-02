function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

async function loadRouteRegistrars() {
  if (process.env.GIOM_USE_TS_ROUTE_REGISTRARS === "true") {
    try {
      return await import("../dist/enterpriseRouteRegistrars.js")
    } catch (error) {
      console.warn("Falling back to JS enterprise route registrars:", getErrorMessage(error))
    }
  }

  return import("./enterpriseRouteRegistrarsSource.js")
}

const routeRegistrars = await loadRouteRegistrars()

export const {
  registerEnterpriseAskRoutes,
  registerEnterpriseAdminRoutes,
  registerEnterpriseBibleRoutes,
  registerEnterpriseCompatRoutes,
  registerEnterpriseFeedbackRoutes,
  registerEnterpriseKnowledgeRoutes,
  registerEnterpriseMediaRoutes,
  registerEnterprisePublicRoutes,
  registerEnterpriseQualityRoutes,
  registerEnterpriseResearchRoutes
} = routeRegistrars