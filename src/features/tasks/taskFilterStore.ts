/** Permite que otras pantallas abran Tareas con una categoría ya filtrada. */
let pendingCategory: string | null = null;
export const setTaskCategory = (id: string | null) => {
  pendingCategory = id;
};
export const takeTaskCategory = () => {
  const v = pendingCategory;
  pendingCategory = null;
  return v;
};
