<template>
  <div class="card border">
    <div class="card-header" :class="{ 'd-none': !(props.removable || props.searchable || props.optionable) }">
      <div class="row align-items-center gx-1">
        <div class="col-12 col-md-3">
          <SelectOption :is-options="props.optionable" :option="props.option" :selectedoption="selectedoption"
            @change="handleSizeChange" />
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
              <Input v-model="searchdata" type="text" class="w-auto shadow-none rounded-0 rounded-end" topclass="mb-0"
                placeholder="Search..." @keyup.enter="searchMe" @keyup.delete="searchMe" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="card-body">
      <slot name="extra"></slot>
      <div class="table-responsive">
        <table
          class="table table-bordered table-striped border-custom table-sm align-middle m-0 datatable no-shrink-table">
          <slot name="customhead"></slot>
          <thead :class="{ 'd-none': slots.customhead }">
            <tr>
              <th class="align-middle" :class="{ 'd-none': !props.removable || !state.current_page }">
                <Checkbox v-model="checked.check" topclass="ms-2" :value="checked.check" :disabled="props.disabled"
                  @click="checkAll" />
              </th>
              <th class="text-center align-middle" :class="{ 'd-none': !props.countable }">#</th>
              <slot name="thead"></slot>
            </tr>
          </thead>

          <slot name="custombody"></slot>
          <tbody :class="{ 'd-none': slots.custombody }">
            <tr v-for="(dt, i) in tableRows" :key="`${dt.id}-${i}`">
              <td class="align-middle" :class="{ 'd-none': !props.removable || !state.current_page }">
                <Checkbox v-model="checked.checkcolumn" topclass="ms-2" :value="dt.id" :disabled="props.disabled"
                  @change="updateChecked" />
              </td>
              <td class="text-center align-middle" :class="{ 'd-none': !props.countable }">
                {{
                  state.current_page
                    ? state.per_page * (state.current_page - 1) + (i + 1)
                    : i + 1
                }}
              </td>
              <slot name="tbody" :td="dt"></slot>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="card-footer" :class="{ 'd-none': state.total <= state.data.length }">
      <Pagination :data="state" @change="handlePageChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { debounce } from "lodash-es";
import SelectOption from "./SelectOpption.vue";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import Checkbox from "@/ui/components/Checkbox.vue";
import Pagination from "./Pagination.vue";
import { computed, reactive, ref, useSlots, watchEffect } from "vue";
import { useGum, type GumTransport } from "@/ui/plugins/gum";

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
  path: string;
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

const emit = defineEmits<{ (event: "remove", value: Array<string | number>): void; }>();

const state = reactive<DataPageState>({
  data: [],
  current_page: 1,
  last_page: 1,
  per_page: Number(props.option[0]) || 15,
  total: 0,
  from: null,
  to: null,
  path: props.path
});

const loading = ref(false);

// checkbox select
let checked = reactive<{ check: boolean; checkcolumn: Array<string | number>; }>({
  check: false,
  checkcolumn: []
});
const checkAll = () => {
  if (!checked.check) {
    state.data.forEach((dt: DataRow) => {
      if (!checked.checkcolumn.includes(dt.id)) {
        checked.checkcolumn.push(dt.id);
      }
    });
  } else {
    checked.checkcolumn = [];
  }
};
const updateChecked = () => checked.checkcolumn.length === state.data.length ? (checked.check = true) : (checked.check = false);

// remove from parent
const remove = () => {
  emit("remove", checked.checkcolumn);
  checked.check = false;
};

// for change data size show
const selectedoption = ref<string | number | undefined>(Number(props.option[0]));
const tableRows = computed<DataRow[]>(() => (props.loop ? props.loop : state.data));

// search data
const searchdata = ref(props.search || "");
const searchMe = debounce(() => {
  load(1);
}, 500);

// fetch directly in-process; no router navigation/scroll restore (gum `navigate: false`)
const load = async (page?: number) => {
  loading.value = true;
  try {
    const res = await gum.get(props.path, {
      navigate: false,
      transport: props.transport,
      baseURL: props.baseURL,
      query: {
        page: page ?? state.current_page,
        size: selectedoption.value,
        search: searchdata.value
      }
    });
    const envelope = (res?.data ?? {}) as Partial<DataPageState>;
    state.data = envelope.data ?? [];
    state.current_page = Number(envelope.current_page) || 1;
    state.last_page = Number(envelope.last_page) || 1;
    state.per_page = Number(envelope.per_page) || Number(selectedoption.value) || 15;
    state.total = Number(envelope.total) || 0;
    state.from = envelope.from ?? null;
    state.to = envelope.to ?? null;
    if (envelope.path) state.path = envelope.path;
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
  if (p > state.last_page) p = state.last_page;
  load(p);
};

// watch instance
watchEffect(() => {
  if (props.option.length) {
    const match = props.option.find((x) => Number(x) === Number(state.per_page)) ?? props.option[0];
    selectedoption.value = match;
  }
  searchdata.value = props.search || "";
});

// initial + subsequent loads when path changes
watchEffect(() => {
  if (props.path) load();
});

defineExpose({ load, state, loading });
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