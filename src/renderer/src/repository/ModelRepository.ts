/**
 * フォルダ構造 models/{modelId} に基づきモデルパスを解決する。
 * 先頭スラッシュなしの相対パスにすることで、
 * 開発時（http://localhost）でも本番時（file://）でも正しく解決する。
 * 規約: models/{modelId}/runtime/{modelId}.model3.json
 */
export function getModelPath(modelId: string): string {
  return `models/${modelId}/runtime/${modelId}.model3.json`
}
