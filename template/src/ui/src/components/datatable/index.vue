<!-- ./src/ui/src/components/datatable/index.vue -->

<template>
  <div class="card border">
    <div class="card-header" :class="{ 'd-none': !(props.removable || props.searchable || props.optionable) }">
      <div class="row align-items-center gx-1">
        <div class="col-12 col-md-3">
          <SelectOption :is-options="props.optionable" :option="props.option" :selectedoption="selectedoption" @change="handleSizeChange" />
        </div>
        <div class="col-12 col-md-9">
          <slot name="extra-tools"></slot>
          <div class="d-flex align-items-center justify-content-center justify-content-md-end">
            <div v-if="checked.checkcolumn.length > 0" class="me-1" :class="{ 'd-none': !props.removable }">
              <Button type="button" class="btn btn-outline-danger" @click.prevent="remove">
                <i class="bi bi-trash"></i>
              </Button>
            </div>
            <div class="d-flex align-items-center" :class="{ 'd-none': !props.searchable }">
              <Button class="btn btn-outline-secondary rounded-0 rounded-start" type="button" @click="searchMe">
                <i class="bi bi-search"></i>
              </Button>
              <Input
                v-model="searchdata"
                type="text"
                class="w-auto shadow-none rounded-0 rounded-end"
                topclass="mb-0"
                placeholder="Search..."
                @keyup.enter="searchMe"
                @keyup.delete="searchMe"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="card-body">
      <slot name="extra"></slot>
      <div class="table-responsive">
        <table class="table table-bordered table-striped border-custom table-sm align-middle m-0 datatable no-shrink-table">
          <slot name="customhead"></slot>
          <thead :class="{ 'd-none': slots.customhead }">
            <tr>
              <th class="align-middle" :class="{ 'd-none': !props.removable || !view.current_page }">
                <Checkbox v-model="checked.check" topclass="ms-2" :value="checked.check" :disabled="props.disabled" @click="checkAll" />
              </th>
              <th class="text-center align-middle" :class="{ 'd-none': !props.countable }">#</th>
              <slot name="thead"></slot>
            </tr>
          </thead>

          <slot name="custombody"></slot>
          <tbody :class="{ 'd-none': slots.custombody }">
            <tr v-for="(dt, i) in tableRows" :key="`${dt.id}-${i}`">
              <td class="align-middle" :class="{ 'd-none': !props.removable || !view.current_page }">
                <Checkbox v-model="checked.checkcolumn" topclass="ms-2" :value="dt.id" :disabled="props.disabled" @change="updateChecked" />
              </td>
              <td class="text-center align-middle" :class="{ 'd-none': !props.countable }">
                {{ view.current_page ? view.per_page * (view.current_page - 1) + (i + 1) : i + 1 }}
              </td>
              <slot name="tbody" :td="dt"></slot>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="card-footer" :class="{ 'd-none': view.total <= view.data.length }">
      <Pagination :data="view" @change="handlePageChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { debounce } from "lodash-es";
import { computed, reactive, ref, useSlots, watch, watchEffect } from "vue";
import Button from "@/ui/components/Button.vue";
import Checkbox from "@/ui/components/Checkbox.vue";
import Input from "@/ui/components/Input.vue";
import { type GumTransport, useGum } from "@/ui/plugins/gum";
import Pagination from "./Pagination.vue";
import SelectOption from "./SelectOpption.vue";

interface DataRow {
  id: string | number;
  [key: string]: any;
}

interface DataPageState {
  data: DataRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
  path: string;
}

interface DataTableProps {
  /**
   * Self-fetch mode: binding name (`app.demo.table`) or REST endpoint that returns
   * the paginate envelope. The table owns its state and reloads when `path` changes.
   */
  path?: string;
  /**
   * Parent-owned mode: the paginate envelope (e.g. a Pinia store's list). When set,
   * the table renders it instead of fetching `path`, so the page owns the rows.
   */
  data?: Partial<DataPageState> | null;
  /**
   * Fetcher mode: the built-in controls (search, size, page) call this instead of
   * self-fetching `path` — e.g. `:fetcher="store.index"`. Called through `gum.getWith`.
   */
  fetcher?: (params: Record<string, unknown>) => Promise<unknown>;
  /**
   * Extra query params merged into every fetch/control call, so filters in the URL
   * or on the page survive a search or a page change.
   */
  filters?: Record<string, unknown>;
  search?: string;
  loop?: DataRow[] | false;
  option?: Array<string | number>;
  removable?: boolean;
  countable?: boolean;
  searchable?: boolean;
  optionable?: boolean;
  disabled?: boolean;
  /** Per-table transport override: "bindings" (SQLite, default from GumPlugin) or "http". */
  transport?: GumTransport;
  /** HTTP transport only: base URL prepended to `path`. */
  baseURL?: string;
}

const props = withDefaults(defineProps<DataTableProps>(), {
  filters: () => ({}),
  search: "",
  loop: false,
  option: () => [10, 25, 50],
  removable: true,
  countable: true,
  searchable: true,
  optionable: true,
  disabled: false
});
const gum = useGum();

const slots = useSlots();

const emit = defineEmits<(event: "remove", value: Array<string | number>) => void>();

// Internal envelope for self-fetch mode; `view` falls back to the parent's `data` when given.
const state = reactive<DataPageState>({
  data: [],
  current_page: 1,
  last_page: 1,
  per_page: Number(props.option[0]) || 15,
  total: 0,
  from: null,
  to: null,
  path: props.path ?? ""
});

const loading = ref(false);

// checkbox select
let checked = reactive<{ check: boolean; checkcolumn: Array<string | number> }>({
  check: false,
  checkcolumn: []
});
const checkAll = () => {
  if (!checked.check) {
    view.value.data.forEach((dt: DataRow) => {
      if (!checked.checkcolumn.includes(dt.id)) {
        checked.checkcolumn.push(dt.id);
      }
    });
  } else {
    checked.checkcolumn = [];
  }
};
const updateChecked = () => (checked.checkcolumn.length === view.value.data.length ? (checked.check = true) : (checked.check = false));

// remove from parent
const remove = () => {
  emit("remove", checked.checkcolumn);
  checked.check = false;
};

// for change data size show
const selectedoption = ref<string | number | undefined>(Number(props.option[0]));

/** Normalize any paginate envelope (the parent's `data` or a fetch result) into a full `DataPageState`. */
const toEnvelope = (d: Partial<DataPageState>): DataPageState => ({
  data: Array.isArray(d.data) ? d.data : [],
  current_page: Number(d.current_page) || 1,
  last_page: Number(d.last_page) || 1,
  per_page: Number(d.per_page) || Number(selectedoption.value) || 15,
  total: Number(d.total) || 0,
  from: d.from ?? null,
  to: d.to ?? null,
  path: d.path ?? props.path ?? ""
});

/** Pull the paginate envelope out of a fetch result, tolerating a `{ data }` wrapper. */
const readEnvelope = (value: unknown): Partial<DataPageState> | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.data)) return v as Partial<DataPageState>;
  const inner = v.data;
  if (inner && typeof inner === "object" && Array.isArray((inner as Record<string, unknown>).data)) {
    return inner as Partial<DataPageState>;
  }
  return null;
};

/** What the table renders: the parent's `data` when provided, else the internal self-fetch `state`. */
const view = computed<DataPageState>(() => (props.data ? toEnvelope(props.data) : state));

const tableRows = computed<DataRow[]>(() => (props.loop ? props.loop : view.value.data));

// search data
const searchdata = ref(props.search || "");
const searchMe = debounce(() => {
  load(1);
}, 500);

/** Extra query params merged last, so a caller-supplied filter survives a search/page/size change. */
const buildQuery = (page?: number): Record<string, unknown> => ({
  page: page ?? view.value.current_page,
  size: selectedoption.value,
  search: searchdata.value,
  ...props.filters
});

/**
 * One entry point for every built-in control (search, size, page).
 *
 * - Fetcher mode (`:fetcher`): calls the parent's fetcher through `gum.getWith` and
 *   adopts the envelope it returns (or lets the parent's `data` prop drive the view).
 * - Path mode (default): fetches the binding/endpoint in-process with
 *   `gum.get(path, { navigate: false })` and fills the internal `state`.
 */
const load = async (page?: number) => {
  const query = buildQuery(page);
  loading.value = true;
  try {
    if (props.fetcher) {
      const fetcher = props.fetcher;
      const res = await gum.getWith({
        fetcher: () => fetcher(query),
        query,
        navigate: false,
        transport: props.transport,
        baseURL: props.baseURL
      });
      if (!props.data) Object.assign(state, toEnvelope(readEnvelope(res) ?? {}));
    } else if (props.path) {
      const res = await gum.get(props.path, {
        navigate: false,
        transport: props.transport,
        baseURL: props.baseURL,
        query
      });
      Object.assign(state, toEnvelope(readEnvelope(res) ?? {}));
    }
    checked.checkcolumn = [];
    checked.check = false;
  } finally {
    loading.value = false;
  }
};

const handleSizeChange = (value: string | number) => {
  selectedoption.value = value;
  load(1);
};

const handlePageChange = (pageNo: string | number) => {
  let p = parseInt(String(pageNo), 10);
  if (Number.isNaN(p) || p < 1) p = 1;
  if (p > view.value.last_page) p = view.value.last_page;
  load(p);
};

// watch instance
watchEffect(() => {
  if (props.option.length) {
    const match = props.option.find((x) => Number(x) === Number(view.value.per_page)) ?? props.option[0];
    selectedoption.value = match;
  }
  searchdata.value = props.search || "";
});

// initial + subsequent loads when `path` changes (self-fetch mode only)
watch(
  () => props.path,
  () => {
    if (props.path && !props.data && !props.loop) load();
  },
  { immediate: true }
);

// external search term change re-queries from page 1 (self-fetch mode only)
watch(
  () => props.search,
  () => {
    if (props.path && !props.data && !props.loop) load(1);
  }
);

defineExpose({ load, state, view, loading });
</script>

<style lang="scss" scoped>
.border-custom {
  border-color: var(--dk-table-border, #cccccc) !important;
}

.no-shrink-table th,
.no-shrink-table td {
  white-space: nowrap;
}

/* By default (large screens and up) do not force a min-width:
   allow table to size normally so no horizontal scrollbar on large screens */
@media (min-width: 992px) {
  .no-shrink-table {
    min-width: 0;
  }
}

@media (max-width: 991.98px) {
  .no-shrink-table {
    min-width: 1000px;
  }
}
</style>
