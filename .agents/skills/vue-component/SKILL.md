---
name: vue-component
description: 编写 Vue3 + TypeScript + Vuetify 组件和页面的开发规范。当用户需要创建新组件、新页面或修改现有 Vue 文件时使用此技能。
---

# Vue 组件开发规范

## 技术栈

- Vue 3.5 (Composition API + `<script setup>`)
- TypeScript (严格类型，禁止 `any`)
- Vuetify 4.0
- 图标: @mdi/js
- 国际化: vue-i18n
- 运行环境: Electron 41+ (Chromium 134+，完整支持 ES2025)
- TypeScript target: ESNext / lib: ESNext + DOM

## 核心规范

### ⚠️ 0. Vuetify v4 强制规范（最高优先级，始终遵循）

项目使用 **Vuetify 4.0.6**。严禁使用 v3 写法。v4 在样式工具类、组件 API、CSS 架构上与 v3 有重大差异，AI 容易因训练数据偏向 v3 而误用。

**何时必须调用 vuetify-mcp:**

| 触发条件                                                                       | 必须调用的工具                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 使用任何 Vuetify 组件 props/events/slots 前，无法确定其在 v4 是否仍存在/未变更 | `mcp__vuetify-mcp__get_component_api_by_version`（默认 `version: "latest"` 即 v4） |
| 从 v3 旧代码、StackOverflow、外部示例片段迁移代码                              | `mcp__vuetify-mcp__get_v4_breaking_changes`（按 category 查询）                    |
| 写指令（`v-ripple`/`v-resize` 等）不确定 v4 API                                | `mcp__vuetify-mcp__get_directive_api_by_version`                                   |
| 涉及主题、栅格、断点、排版等系统特性                                           | `mcp__vuetify-mcp__get_feature_guide`                                              |

**写完后必做：** 对照下方"v3 → v4 速查表"自检，确保未出现任何 v3 写法。

#### v3 → v4 速查表（严禁出现 v3 写法）

| 类别                                                               | v3 写法（❌ 禁用）                  | v4 写法（✅ 使用）                                                                                |
| ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| 大标题字号                                                         | `text-h1` `text-h2` `text-h3`       | `text-display-large` (57px) / `text-display-medium` (45px) / `text-display-small` (36px)          |
| 中标题字号                                                         | `text-h4` `text-h5` `text-h6`       | `text-headline-large` (32px) / `text-headline-medium` (28px) / `text-headline-small` (24px)       |
| 副标题字号                                                         | `text-subtitle-1` `text-subtitle-2` | `text-title-large` (22px) / `text-title-medium` (16px,w500) / `text-title-small` (14px,w500)      |
| 正文字号                                                           | `text-body-1` `text-body-2`         | `text-body-large` (16px) / `text-body-medium` (14px) / `text-body-small` (12px)                   |
| 小字/说明                                                          | `text-caption` `text-overline`      | `text-label-large` (14px,w500) / `text-label-medium` (12px,w500) / `text-label-small` (11px,w500) |
| 响应式字号                                                         | `text-md-h4` 等                     | `text-sm-/md-/lg-/xl-` + 上述 MD3 类（如 `text-md-headline-large`）                               |
| 按钮文字大写                                                       | 默认大写，无需处理                  | **默认正常大小写**，如需大写显式 `text-transform: uppercase`                                      |
| 主题默认值                                                         | `defaultTheme: 'light'`             | `defaultTheme: 'system'`（跟随 OS；需固定 light 时显式声明）                                      |
| CSS 优先级覆盖                                                     | 用 `!important` 覆盖 Vuetify 样式   | CSS layers 强制开启，`!important` 不再总是有效；改用 `@layer` 或更高特异度选择器                  |
| `<v-form>` slot props                                              | 当作 ref 使用，需 `.value`          | 已 unref，直接访问值                                                                              |
| `<v-select>`/`<v-autocomplete>`/`<v-combobox>` 的 `item` slot 参数 | `#item="{ item }"`                  | `#item="{ internalItem }"`                                                                        |
| Material Design 版本                                               | MD2（字号、阴影、间距、栅格）       | MD3（视觉规范完全不同，迁移代码需重新评估观感）                                                   |
| 默认断点                                                           | 较大                                | **缩小**，响应式布局需重测                                                                        |

#### 其他 v4 关键变更（容易踩坑）

- **CSS 层强制开启**：Vuetify 所有样式都在 `@layer` 中。自定义 scoped 样式需要层级感知，写覆盖时避免依赖 `!important`。
- **CSS reset 大幅精简**：`overflow-y` 等元素默认重置已移除，依赖处需自行补充。
- **栅格系统重构**：`v-container/v-row/v-col` 行为可能微调，布局需测试。
- **`elevation` 视觉变化**：MD3 阴影曲线不同于 v3，使用 `elevation` 属性后需重新评估视觉。
- **VBtn 内部布局**：从 `display: grid` 改为 `display: flex`，依赖按钮内部 CSS 的自定义样式需检查。

#### 完成前自检清单

- [ ] 模板中无 `text-h1`~`text-h6`、`text-body-1`、`text-body-2`、`text-subtitle-1`、`text-subtitle-2`、`text-caption`、`text-overline` 等 v3 字号类
- [ ] 响应式字号无 `text-md-h4` 等 v3 形式（应为 `text-md-headline-large` 等）
- [ ] 自定义样式未依赖 `!important` 覆盖 Vuetify 组件
- [ ] `<v-select>`/`<v-autocomplete>` 自定义 `item` slot 使用 `internalItem` 解构
- [ ] `<v-form>` slot props 未误加 `.value`
- [ ] 不确定的 props 已通过 `get_component_api_by_version` 在 v4 中确认存在

### 1. TypeScript 类型

禁止 `any`，必须明确类型：

```typescript
const loading = ref<boolean>(false)
const notes = ref<Note[]>([])
```

### 2. 自动导入

已配置 unplugin-auto-import，无需导入 `ref/computed/watch/onMounted` 等 Vue API。

### 3. 图标

```typescript
import { mdiPlus, mdiDelete } from '@mdi/js'
// 使用: <v-icon :icon="mdiPlus" />
```

### 4. 国际化

组件底部使用 `<i18n>` 块，含 `zhHans` 和 `en`：

```vue
<i18n>
{
  "zhHans": { "title": "标题" },
  "en": { "title": "Title" }
}
</i18n>
```

```typescript
const { t } = useI18n()
// 使用: {{ t('title') }}
```

### 5. 样式优先级

1. **Vuetify 工具类** (优先)
   - 间距: `pa-4`, `mx-2`, `py-8`, `ga-3`
   - 布局: `d-flex`, `flex-column`, `align-center`, `justify-space-between`
   - 文字: `text-headline-small`, `text-body-small`, `text-medium-emphasis`, `font-weight-bold`
   - 颜色: `bg-surface`, `bg-primary`, `text-primary`
   - 圆角: `rounded`, `rounded-lg`, `rounded-xl`, `rounded-pill`
   - 响应式: `d-none`, `d-md-flex`

2. **项目公共样式** (`styles/modules/` + `global.css`)
   - `card-style` - 标准卡片 (surface背景+边框)
   - `card-inner-card` - 内嵌卡片 (subtle背景+hover效果)
   - `line-clamp-2` - 两行省略
   - `transition-all` - 0.15s过渡
   - `z-1/z-10/z-99` - 层级
   - `app-drag/app-no-drag` - 窗体拖拽区

3. **scoped 样式** (仅在以上不满足时)

### 6. 风格参考

```
/* 主题色变量 */
rgb(var(--v-theme-surface))        /* 表面背景 */
rgb(var(--v-theme-background))     /* 页面背景 */
rgb(var(--v-theme-primary))        /* 主色 */
rgb(var(--v-theme-on-surface))     /* 表面文字色 */
rgba(var(--v-theme-primary), 0.15) /* 主色半透明 */

/* 边框变量 */
rgba(var(--v-border-color), var(--v-border-opacity))           /* 标准边框 */
rgba(var(--v-border-color), var(--v-card-block-border-alpha))  /* 卡片内边框 */

/* 常用圆角 */
border-radius: 8px;   /* 标准 */
border-radius: 10px;  /* 较大 */
```

### 7. 响应式

```typescript
const { smAndDown } = useDisplay()
// 用于: :permanent="!smAndDown" 或 v-if="smAndDown"
// 类: d-none d-md-flex
```

### 8. 中文注释

代码需有中文注释说明。

### 9. 事件命名

自定义事件名必须使用 kebab-case（ESLint: `vue/custom-event-name-casing`）：

```
// 正确
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'item-select': [item: Item]
  'results-change': [results: Result[]]
}>()

emit('item-select', item)
emit('results-change', results)

// 错误
const emit = defineEmits<{
  itemSelect: [item: Item]      // 应为 'item-select'
  resultsChange: [results: Result[]]  // 应为 'results-change'
}>()
```

### 10. Props 解构与默认值（Vue 3.5+）

Vue 3.5 支持响应式 props 解构，解构后的变量保持响应性，无需 `toRefs`：

```typescript
// ✅ 推荐：解构 + 默认值（Vue 3.5 响应式解构）
const {
  title,
  count = 0,
  disabled = false
} = defineProps<{
  title: string
  count?: number
  disabled?: boolean
}>()
```

```typescript
// ✅ 推荐：对象/数组默认值同样直接在解构中赋值
const { items = [], options = {} } = defineProps<{
  items?: Item[]
  options?: Record<string, unknown>
}>()
```

```typescript
// ❌ 避免：withDefaults（Vue 3.5 解构默认值已完全替代）
withDefaults(defineProps<{ items?: Item[] }>(), {
  items: () => [] // 不再需要
})
```

```typescript
// ❌ 避免：在 script 中用非解构方式访问 props
const props = defineProps<{ title: string }>()
console.log(props.title) // 可以工作，但解构更简洁
```

```typescript
// ❌ 避免：运行时默认值逻辑（应使用解构默认值）
const props = defineProps<{ count?: number }>()
const realCount = computed(() => props.count ?? 0) // 多余，直接用解构默认值
```

**关键规则：**

- 所有类型默认值统一使用解构赋值：`const { size = 'medium', items = [] } = defineProps(...)`
- 对象/数组默认值无需 `withDefaults`，Vue 3.5 解构会自动处理实例隔离
- 解构后的变量可直接在模板和 script 中使用，保持响应性
- 不要对解构的 props 使用 `watch` 监听（直接监听 props 名），改用 `watch(() => propName, ...)`

### 11. 双向绑定（Vue 3.5+）

优先使用 `defineModel()` 替代 `props + emit('update:modelValue')` 模式：

```typescript
// ✅ 推荐：defineModel（Vue 3.5+）
const modelValue = defineModel<string>()
const title = defineModel<string>('title')
const count = defineModel<number>({ default: 0 })

// ❌ 旧版写法（避免在新代码中使用）
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
```

**关键规则：**

- 默认绑定：`defineModel()` 等价于 `modelValue` 的 props + emit
- 具名绑定：`defineModel('title')` 等价于 `title` 的 props + `emit('update:title')`
- 带默认值：`defineModel<number>({ default: 0 })`
- 模板中使用 `v-model` 或 `v-model:title` 即可

### 12. useTemplateRef（Vue 3.5+）

Vue 3.5 引入 `useTemplateRef()` 替代旧版 `ref` 绑定模板元素的模式：

```typescript
// ✅ 推荐：useTemplateRef（Vue 3.5+，类型自动推断）
const inputRef = useTemplateRef('inputRef')
const listRef = useTemplateRef('listRef')

// 在模板中: <input ref="inputRef" /> 或 <v-list ref="listRef" />
// 类型根据模板元素自动推断，无需手动指定泛型

// 使用
onMounted(() => {
  inputRef.value?.focus()
})
```

```typescript
// ❌ 旧版写法（避免在新代码中使用）
const inputRef = ref<HTMLInputElement>()
// 模板中: <input ref="inputRef" />
```

**优势：**

- 语义更明确：`useTemplateRef` 清晰表明是模板引用，与响应式 `ref` 区分
- 类型自动推断：根据模板中绑定的元素/组件自动推导类型，无需手动写泛型
- 命名一致性：ref 名与模板中 `ref="xxx"` 字符串必须一致

**注意：** `useTemplateRef` 的参数是字符串，必须与模板中 `ref` 属性值完全匹配：

```vue
<template>
  <input ref="searchInput" />
</template>

<script lang="ts" setup>
const searchInput = useTemplateRef('searchInput')

// 使用示例：自动聚焦
onMounted(() => {
  searchInput.value?.focus()
})
</script>
```

### 13. 优先使用 VueUse 函数库

开发 Vue 组件功能时，**必须首先检查** `.agents/skills/vueuse-functions/SKILL.md` 中是否有现成的 VueUse 组合式函数可以使用。优先采用 VueUse 提供的函数，而不是编写自定义代码。

**决策流程：**

1. 需求分析后，先查阅 VueUse 函数列表，确认是否有匹配的 composable
2. 若有匹配，使用 VueUse 函数实现，遵循其调用规则
3. 仅在 VueUse 无对应函数时，才编写自定义 composable

**调用规则（Invocation）：**

| 规则            | 说明                                                                               |
| --------------- | ---------------------------------------------------------------------------------- |
| `AUTO`          | 适用时自动使用，无需额外依赖                                                       |
| `EXTERNAL`      | 需要额外安装依赖包，仅当项目已安装该依赖时使用；否则重新评估，仅在真正需要时才安装 |
| `EXPLICIT_ONLY` | 仅当用户明确要求时才使用                                                           |

**常见场景映射：**

| 需求           | VueUse 函数                             |
| -------------- | --------------------------------------- |
| 防抖函数       | `useDebounceFn`                         |
| 节流函数       | `useThrottleFn`                         |
| 监听元素大小   | `useResizeObserver`                     |
| 监听滚动       | `useScroll`                             |
| 监听点击外部   | `onClickOutside`                        |
| 键盘事件       | `onKeyStroke`                           |
| 本地存储       | `useLocalStorage` / `useSessionStorage` |
| 异步状态       | `useAsyncState`                         |
| 元素拖拽       | `useDraggable`                          |
| 响应式窗口大小 | `useWindowSize`                         |
| 响应式元素尺寸 | `useElementSize` / `useElementBounding` |
| 交互观察       | `useIntersectionObserver`               |

> 使用任何 VueUse 函数时，务必查阅 `.agents/skills/vueuse-functions/references/` 目录下对应的参考文档，了解用法详情和类型声明。

### 14. 优先使用 ES2015-ES2025 标准 API

**核心原则：优先使用标准库内置 API，避免手动重复实现已有功能。**

项目运行在 Electron 41+（Chromium 134+），TypeScript target 为 ESNext，可完整使用 ES2015-ES2025 所有特性。

#### ✅ 推荐 vs ❌ 避免速查

| 需求               | ✅ 推荐                                                     | ❌ 避免                                  |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------- | --------- | ----------------- |
| 判断元素存在       | `arr.includes(item)`                                        | `arr.indexOf(item) !== -1`               |
| 负索引访问         | `arr.at(-1)`                                                | `arr[arr.length - 1]`                    |
| 不可变排序/反转    | `arr.toSorted()` / `arr.toReversed()`                       | `[...arr].sort()` / `[...arr].reverse()` |
| 不可变替换/splice  | `arr.with(i, v)` / `arr.toSpliced()`                        | `arr.map()` 替换 / 手动 slice+concat     |
| 查找最后匹配       | `arr.findLast()` / `.findLastIndex()`                       | `[...arr].reverse().find()`              |
| 扁平映射           | `arr.flatMap(fn)`                                           | `arr.map(fn).flat()`                     |
| 分组               | `Object.groupBy()` / `Map.groupBy()`                        | 手动 reduce                              |
| 判断自身属性       | `Object.hasOwn(obj, key)`                                   | `obj.hasOwnProperty(key)`                |
| 深拷贝             | `structuredClone(obj)`                                      | `JSON.parse(JSON.stringify())`           |
| 对象转换           | `Object.entries()` + `Object.fromEntries()`                 | `for...in` 遍历                          |
| 全局替换           | `str.replaceAll(search, replacement)`                       | `str.split().join()` 或正则              |
| 字符串起止判断     | `str.startsWith()` / `str.endsWith()`                       | `str.indexOf() === 0`                    |
| 安全属性访问       | `user?.address?.city ?? '默认'`                             | `user && user.address && ...`            |
| 逻辑赋值           | `config.count ??= 0` / `options.mode                        |                                          | = 'auto'` | `if (!x) x = ...` |
| Promise 外部控制   | `Promise.withResolvers()`                                   | 手动提取 resolve/reject                  |
| 包装同步为 Promise | `Promise.try(fn)`                                           | `new Promise(r => r(fn()))`              |
| Set 集合运算       | `a.intersection(b)` / `.union()` / `.difference()`          | 手动 filter+new Set                      |
| Set 关系判断       | `a.isSubsetOf(b)` / `.isSupersetOf()` / `.isDisjointFrom()` | 手动遍历比较                             |
| 惰性迭代           | `iterator.filter().map().take(n).toArray()`                 | `[...data].filter().map().slice()`       |

#### 常用模式示例

```typescript
// 不可变数组操作（ES2023）
const sorted = items.toSorted((a, b) => a.name.localeCompare(b.name))
const updated = items.with(2, newItem)
const last = items.at(-1)

// 分组（ES2024）
const byStatus = Object.groupBy(tasks, t => t.status)
const byCategory = Map.groupBy(items, i => i.category)

// 安全访问 + 默认值（ES2020）
const city = user?.address?.city ?? '未知'

// 逻辑赋值（ES2021）
config.limit ??= 10
options.format ||= 'json'

// 深拷贝（ES2022）— 支持循环引用、Date、RegExp、Map、Set
const copy = structuredClone(originalData)

// Set 集合运算（ES2025）
const toAdd = selectedIds.difference(existingIds)
const toRemove = existingIds.difference(selectedIds)

// Promise 控制（ES2024/2025）
const { promise, resolve } = Promise.withResolvers<string>()
const result = await Promise.try(() => parseJSON(raw))

// 惰性迭代（ES2025）— 无中间数组
const top10 = Iterator.from(data.values())
  .filter(i => i.active)
  .map(i => i.name)
  .take(10)
  .toArray()
```

#### 特性版本速查

| 版本   | 核心特性                                                                        | 用途               |
| ------ | ------------------------------------------------------------------------------- | ------------------ |
| ES2015 | `const/let`、箭头函数、解构、展开、模板字符串、`Promise`、`Map/Set`、`for...of` | 基础语法           |
| ES2017 | `async/await`、`Object.values/entries()`                                        | 异步流程、对象遍历 |
| ES2019 | `Array.flat/flatMap()`、`Object.fromEntries()`                                  | 扁平化、对象重建   |
| ES2020 | 可选链 `?.`、空值合并 `??`、`import.meta`                                       | 安全访问、默认值   |
| ES2021 | `replaceAll()`、逻辑赋值 `??=/\|\|=/&&=`                                        | 替换、默认值       |
| ES2022 | `Array.at()`、`Object.hasOwn()`、`structuredClone()`、顶层 `await`              | 深拷贝、负索引     |
| ES2023 | `findLast/LastIndex()`、`toSorted/toReversed/toSpliced/with()`                  | 不可变数组         |
| ES2024 | `Object/Map.groupBy()`、`Promise.withResolvers()`                               | 分组、Promise 控制 |
| ES2025 | `Set` 集合方法、`Iterator` 辅助、`Promise.try()`、`Array.fromAsync()`           | 集合运算、惰性迭代 |

## 组件模板

```
<template>
  <v-app>
    <v-app-bar app flat>
      <v-toolbar-title>{{ t('title') }}</v-toolbar-title>
      <template #append>
        <v-btn color="primary" :prepend-icon="mdiPlus" @click="showDialog = true">
          {{ t('add') }}
        </v-btn>
      </template>
    </v-app-bar>
    <v-main>
      <v-container>
        <!-- 搜索栏 -->
        <v-text-field
          ref="searchInput"
          v-model="keyword"
          density="compact"
          hide-details
          rounded="lg"
          variant="solo-filled"
          :placeholder="t('search')"
          class="mb-4"
          @update:model-value="onSearch"
        />
        <!-- 加载状态 -->
        <div v-if="loading" class="text-center py-8">
          <v-progress-circular color="primary" indeterminate />
        </div>
        <!-- 空状态 -->
        <div v-else-if="filteredItems.length === 0" class="text-center py-12">
          <v-icon color="grey" :icon="mdiInboxOutline" size="64" />
          <p class="text-body-medium mt-4 text-medium-emphasis">{{ t('empty') }}</p>
        </div>
        <!-- 按分组展示内容列表 -->
        <div v-else>
          <template v-for="[group, items] in groupedItems" :key="group">
            <v-list-subheader>{{ group }}</v-list-subheader>
            <v-list density="comfortable" nav>
              <v-list-item
                v-for="item in items"
                :key="item.id"
                :title="item.name"
                @click="emit('item-select', item)"
              />
            </v-list>
          </template>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<script lang="ts" setup>
/**
 * 组件功能描述
 */

import { useDisplay } from 'vuetify'
import { mdiPlus, mdiInboxOutline } from '@mdi/js'

interface Item { id: number; name: string; status: string }

// Props 解构（Vue 3.5+）— 解构变量保持响应性
const { title, pageSize = 20 } = defineProps<{
  title: string
  pageSize?: number
}>()

// 事件声明
const emit = defineEmits<{
  'item-select': [item: Item]
}>()

const { t } = useI18n()
const { smAndDown } = useDisplay()

// 模板引用（Vue 3.5+ useTemplateRef，类型自动推断）
const searchInput = useTemplateRef('searchInput')

const loading = ref<boolean>(false)       // 加载状态
const items = ref<Item[]>([])             // 列表数据
const keyword = ref<string>('')           // 搜索关键词
const showDialog = ref<boolean>(false)    // 对话框状态

// 搜索过滤（ES2020 可选链 + 空值合并）
const filteredItems = computed(() =>
  keyword.value
    ? items.value.filter(item =>
        item.name.toLowerCase().includes(keyword.value.toLowerCase())
      )
    : items.value
)

// 按状态分组展示（ES2024 Object.groupBy）
const groupedItems = computed(() =>
  Object.entries(Object.groupBy(filteredItems.value, item => item.status))
)

async function loadData() {
  try {
    loading.value = true
    // API 调用
  } catch (error) {
    // error.cause 可传递原始错误（ES2022 Error.cause）
    if (error instanceof ApiError) {
      errorMessage.value = error.message
    }
  } finally {
    loading.value = false
  }
}

// 搜索防抖（优先使用 VueUse 函数）
const onSearch = useDebounceFn(() => {
  // 搜索逻辑
}, 300)

onMounted(() => {
  loadData()
  // 自动聚焦搜索框（ES2022 可选链）
  searchInput.value?.focus()
})
</script>

<style scoped>
/* 仅在 Vuetify 工具类不满足时添加 */
</style>

<i18n>
{
  "zhHans": { "title": "标题", "empty": "暂无数据", "add": "新增", "search": "搜索..." },
  "en": { "title": "Title", "empty": "No data", "add": "Add", "search": "Search..." }
}
</i18n>
```

## 常用组件属性

```
<v-card variant="outlined" rounded="lg">
<v-btn color="primary" :prepend-icon="mdiPlus">
<v-text-field density="compact" hide-details rounded="lg" variant="solo-filled" />
<v-list density="comfortable" nav>
<v-chip color="primary" rounded="xl" size="small">
```
