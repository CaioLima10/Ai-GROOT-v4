function resolveSupabaseEnv() {
  return {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey:
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY
  }
}

function ensureTableStore(mockData, table) {
  if (!mockData.has(table)) {
    mockData.set(table, [])
  }

  return mockData.get(table)
}

function buildMockId() {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function normalizeRows(value) {
  return Array.isArray(value) ? value : [value]
}

function normalizeLikeValue(value) {
  return String(value || "").toLowerCase().replace(/%/g, "")
}

function selectColumns(record, columns) {
  if (!columns || columns === "*") {
    return { ...record }
  }

  const selectedColumns = String(columns)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (!selectedColumns.length) {
    return { ...record }
  }

  return selectedColumns.reduce((result, column) => {
    if (column in record) {
      result[column] = record[column]
    }
    return result
  }, {})
}

function applyFilters(records, filters) {
  return records.filter((record) =>
    filters.every((filter) => {
      const value = record?.[filter.column]

      if (filter.type === "eq") {
        return value === filter.value
      }

      if (filter.type === "like" || filter.type === "ilike") {
        if (typeof value !== "string") return false
        return value.toLowerCase().includes(normalizeLikeValue(filter.value))
      }

      if (filter.type === "gt") {
        return value > filter.value
      }

      if (filter.type === "gte") {
        return value >= filter.value
      }

      if (filter.type === "lt") {
        return value < filter.value
      }

      if (filter.type === "lte") {
        return value <= filter.value
      }

      return true
    })
  )
}

function applyOrdering(records, orderBy) {
  if (!orderBy?.column) {
    return [...records]
  }

  return [...records].sort((left, right) => {
    const leftValue = left?.[orderBy.column]
    const rightValue = right?.[orderBy.column]

    if (leftValue === rightValue) return 0
    if (leftValue == null) return orderBy.ascending ? -1 : 1
    if (rightValue == null) return orderBy.ascending ? 1 : -1
    if (leftValue < rightValue) return orderBy.ascending ? -1 : 1
    return orderBy.ascending ? 1 : -1
  })
}

function applyWindow(records, rangeWindow, limitCount) {
  const sorted = [...records]

  if (rangeWindow) {
    return sorted.slice(rangeWindow.from, rangeWindow.to + 1)
  }

  if (Number.isFinite(limitCount)) {
    return sorted.slice(0, Math.max(0, limitCount))
  }

  return sorted
}

function resolveUpsertKey(record) {
  if (!record || typeof record !== "object") return null
  return ["id", "user_id", "request_id", "email"].find((key) => record[key] != null) || null
}

function createMockQueryBuilder(mockData, table) {
  const state = {
    operation: "select",
    columns: "*",
    countMode: null,
    filters: [],
    orderBy: null,
    rangeWindow: null,
    limitCount: null,
    payload: null,
    singleMode: null
  }

  async function execute() {
    const tableData = ensureTableStore(mockData, table)
    const filteredRecords = applyFilters(tableData, state.filters)
    let rows = []

    if (state.operation === "insert") {
      rows = normalizeRows(state.payload).map((record) => ({
        ...record,
        id: record?.id || buildMockId(),
        created_at: record?.created_at || new Date().toISOString()
      }))
      tableData.push(...rows)
    } else if (state.operation === "upsert") {
      rows = normalizeRows(state.payload).map((record) => {
        const upsertKey = resolveUpsertKey(record)
        const existingIndex = upsertKey
          ? tableData.findIndex((entry) => entry?.[upsertKey] === record?.[upsertKey])
          : -1
        const nextRecord = {
          ...record,
          id: record?.id || (existingIndex >= 0 ? tableData[existingIndex]?.id : buildMockId()),
          created_at: existingIndex >= 0
            ? tableData[existingIndex]?.created_at || new Date().toISOString()
            : record?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        if (existingIndex >= 0) {
          tableData[existingIndex] = { ...tableData[existingIndex], ...nextRecord }
          return { ...tableData[existingIndex] }
        }

        tableData.push(nextRecord)
        return { ...nextRecord }
      })
    } else if (state.operation === "update") {
      rows = filteredRecords.map((record) => {
        const nextRecord = {
          ...record,
          ...state.payload,
          updated_at: new Date().toISOString()
        }
        const index = tableData.findIndex((entry) => entry?.id === record?.id)
        if (index >= 0) {
          tableData[index] = nextRecord
        }
        return { ...nextRecord }
      })
    } else if (state.operation === "delete") {
      rows = filteredRecords.map((record) => ({ ...record }))
      const remaining = tableData.filter((record) => !filteredRecords.includes(record))
      mockData.set(table, remaining)
    } else {
      rows = filteredRecords.map((record) => ({ ...record }))
    }

    rows = applyOrdering(rows, state.orderBy)
    const totalCount = rows.length
    rows = applyWindow(rows, state.rangeWindow, state.limitCount)
    rows = rows.map((record) => selectColumns(record, state.columns))

    if (state.singleMode === "single") {
      if (!rows.length) {
        return {
          data: null,
          error: { message: "No rows found" },
          count: state.countMode === "exact" ? totalCount : null
        }
      }

      return {
        data: rows[0],
        error: null,
        count: state.countMode === "exact" ? totalCount : null
      }
    }

    if (state.singleMode === "maybeSingle") {
      return {
        data: rows[0] || null,
        error: null,
        count: state.countMode === "exact" ? totalCount : null
      }
    }

    return {
      data: rows,
      error: null,
      count: state.countMode === "exact" ? totalCount : null
    }
  }

  const builder = {
    select(columns = "*", options = {}) {
      state.columns = columns
      state.countMode = options?.count || null
      return builder
    },
    insert(payload) {
      state.operation = "insert"
      state.payload = payload
      return builder
    },
    upsert(payload) {
      state.operation = "upsert"
      state.payload = payload
      return builder
    },
    update(payload) {
      state.operation = "update"
      state.payload = payload
      return builder
    },
    delete() {
      state.operation = "delete"
      state.payload = null
      return builder
    },
    eq(column, value) {
      state.filters.push({ type: "eq", column, value })
      return builder
    },
    like(column, value) {
      state.filters.push({ type: "like", column, value })
      return builder
    },
    ilike(column, value) {
      state.filters.push({ type: "ilike", column, value })
      return builder
    },
    gt(column, value) {
      state.filters.push({ type: "gt", column, value })
      return builder
    },
    gte(column, value) {
      state.filters.push({ type: "gte", column, value })
      return builder
    },
    lt(column, value) {
      state.filters.push({ type: "lt", column, value })
      return builder
    },
    lte(column, value) {
      state.filters.push({ type: "lte", column, value })
      return builder
    },
    order(column, { ascending = true } = {}) {
      state.orderBy = { column, ascending }
      return builder
    },
    limit(value) {
      state.limitCount = Number(value)
      return builder
    },
    range(from, to) {
      state.rangeWindow = {
        from: Number(from),
        to: Number(to)
      }
      return builder
    },
    single() {
      state.singleMode = "single"
      return builder
    },
    maybeSingle() {
      state.singleMode = "maybeSingle"
      return builder
    },
    then(onFulfilled, onRejected) {
      return execute().then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      return execute().catch(onRejected)
    },
    finally(onFinally) {
      return execute().finally(onFinally)
    }
  }

  return builder
}

function createMockClient() {
  const mockData = new Map()

  return {
    from(table) {
      return createMockQueryBuilder(mockData, table)
    }
  }
}

export async function initializeSupabase() {
  try {
    const { supabaseUrl, supabaseKey } = resolveSupabaseEnv()

    if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️ Supabase environment variables not found (SUPABASE_URL / SUPABASE_ANON_KEY). Using mock client.")
      return createMockClient()
    }

    const { createClient } = await import("@supabase/supabase-js")
    console.log("✅ Supabase client initialized")
    return createClient(supabaseUrl, supabaseKey)
  } catch (error) {
    console.warn("⚠️ Supabase not available, using mock client:", error?.message || error)
    return createMockClient()
  }
}

const supabase = await initializeSupabase()

export default supabase
