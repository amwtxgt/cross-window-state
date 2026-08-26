---
name: code-comments
description: 'Vue3 + TypeScript + Electron 项目的代码注释规范。定义了文件头注释、函数注释、接口注释、行内注释的标准格式。在编写或修改代码时使用此规范确保注释风格一致。'
license: MIT
metadata:
  author: Fieldano Team
  version: '1.0.0'
---

# 代码注释规范

本规范适用于 Vue3 + TypeScript + Electron 项目的代码注释。

## 基本原则

1. **注释语言**：全部使用中文
2. **注释风格**：使用 JSDoc 格式
3. **保持简洁**：注释应简明扼要，避免冗余
4. **及时更新**：代码变更时同步更新注释

## 文件头注释

每个重要文件应包含文件头注释，说明文件用途、作者和创建时间。

### 格式

```typescript
/**
 * @用途 [文件的主要功能描述]
 * @author [作者姓名]
 * @创建时间 [YYYY-MM-DD]
 **/
```

### 示例

```typescript
/**
 * @用途 浏览器主进程入口
 * @author 张三
 * @创建时间 2024-03-21
 **/
```

## 函数/方法注释

所有导出函数和类方法应使用 JSDoc 注释。

### 格式

```typescript
/**
 * 函数功能描述
 * @param paramName 参数说明
 * @returns 返回值说明
 */
```

### 示例

```typescript
/**
 * 初始化Sentry错误监控
 * 只在非开发环境中启用
 */
function initializeSentry(): void {
  // ...
}

/**
 * 根据ID查找用户信息
 * @param userId 用户唯一标识
 * @returns 用户信息对象，未找到返回 null
 */
function findUserById(userId: string): User | null {
  // ...
}
```

### 复杂函数示例

```typescript
/**
 * 创建新的标签页
 * @param url 要打开的URL地址
 * @param options 标签页配置选项
 * @param options.active 是否激活新标签页
 * @param options.position 标签页位置
 * @returns 新创建的标签页实例
 * @throws 当URL无效时抛出错误
 */
function createTab(url: string, options?: TabOptions): Tab {
  // ...
}
```

## 接口/类型注释

接口字段使用单行 JSDoc 注释。

### 格式

```typescript
interface InterfaceName {
  /** 字段说明 */
  fieldName: FieldType
}
```

### 示例

```typescript
interface StorageData<T> {
  /** 数据版本号 */
  version: number
  /** 实际状态数据 */
  data: T
  /** 数据更新时间戳 */
  updatedAt: number
}

interface TabEntity {
  /** 标签页类型 */
  type: 'tab'
  /** 同一浏览器内标签唯一编号 */
  id: number
  /** 标签标题 */
  title: string
  /** 当前页面URL */
  url: string
  /** 图标（如mdi图标） */
  icon?: string
  /** 网站favicon，优先显示 */
  favicon?: string
}
```

### 复杂字段示例

```typescript
interface TabEntity {
  /**
   * 侧边栏配置（仅布局相关，可持久化）
   */
  sidebarConfig?: {
    /** 侧边栏宽度 */
    width: number
    /** 是否可调整大小 */
    resizable: boolean
  }
}
```

## 行内注释

用于解释复杂逻辑或特殊处理。

### 格式

```typescript
// 注释内容
```

### 示例

```typescript
// 禁用安全警告
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// 必须在 app ready 之前调用
app.commandLine.appendSwitch('ignore-gpu-blacklist')

// E2E 环境下：在主进程将部分 Electron 能力挂载到 global
if (process.env.E2E === 'true') {
  ;(global as any).e2eClipboard = clipboard
}
```

## Vue 组件注释

### Script 部分

```vue
<script setup lang="ts">
/**
 * @用途 标签页组件
 * @author 李四
 * @创建时间 2024-05-10
 */

// Props 定义
const props = defineProps<{
  /** 标签页ID */
  id: number
  /** 标签页标题 */
  title: string
  /** 是否激活状态 */
  active?: boolean
}>()

// Emits 定义
const emit = defineEmits<{
  /** 关闭标签页事件 */
  close: [id: number]
  /** 激活标签页事件 */
  activate: [id: number]
}>()
</script>
```

## 特殊注释标记

### TODO

```typescript
// TODO: 待实现的功能说明
```

### FIXME

```typescript
// FIXME: 需要修复的问题说明
```

### HACK

```typescript
// HACK: 临时解决方案说明
```

### 示例

```typescript
// TODO: 后续需要添加缓存机制
function fetchData() {
  // ...
}

// FIXME: 在某些边界条件下可能返回 undefined
function parseResponse(data: unknown) {
  // ...
}

// HACK: 临时绕过类型检查，等待上游库更新
;(window as any).customApi = api
```

## 禁用 ESLint 注释

当需要禁用 ESLint 规则时，应说明原因。

### 格式

```typescript
// eslint-disable-next-line rule-name -- 原因说明
```

### 示例

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 第三方库类型定义缺失
const result = thirdPartyLib.call() as any

// eslint-disable-next-line vue/no-v-html -- 已对内容进行 XSS 过滤
<div v-html="sanitizedContent"></div>
```

## 不需要注释的情况

以下情况可省略注释：

1. **自解释代码**：变量名、函数名已足够清晰
2. **简单 getter/setter**：无复杂逻辑
3. **标准 CRUD 操作**：常规增删改查
4. **私有工具函数**：仅内部使用且逻辑简单

### 反例（过度注释）

```typescript
// ❌ 不推荐
// 用户ID
const userId = 123

// 获取用户名
function getUserName() {
  return this.name
}
```

### 正例

```typescript
// ✅ 推荐 - 名称已足够清晰，无需注释
const userId = 123

function getUserName() {
  return this.name
}
```

## 日志输出规范

使用统一的日志前缀表示状态。

```typescript
console.log('✅ 操作成功的信息')
console.log('🔄 正在进行的操作...')
console.warn('⚠️ 警告信息')
console.error('❌ 错误信息')
```

### 示例

```typescript
console.log('✅ 主进程数据库管理器初始化成功')
console.log('🔄 应用即将退出，正在清理资源...')
console.warn('⚠️ 未找到配置文件，使用默认配置')
console.error('❌ 关闭数据库管理器时发生错误:', error)
```
