<template>
  <div class="d-flex align-items-center justify-content-center justify-content-md-start mb-2 mb-md-0"
    :class="{ 'd-none': !props.isOptions }">
    Show
    <select
      :value="selectedoption"
      class="form-select shadow-none w-auto mx-2"
      @change="onChange">
      <option v-for="(val, i) in props.option" :key="i" :value="val">{{ val }}</option>
    </select>
    entries
  </div>
</template>

<script setup lang="ts">
interface SelectOptionProps {
  isOptions?: boolean;
  option?: Array<string | number>;
  selectedoption?: string | number;
}

const props = withDefaults(defineProps<SelectOptionProps>(), {
  isOptions: true,
  option: () => []
});

const emit = defineEmits<{ (event: "change", value: string | number): void }>();

const onChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  emit("change", target.value);
};
</script>

<style lang="scss" scoped></style>