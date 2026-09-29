package ai

import (
	"strings"
	"testing"
)

// 缓存与判定表化都不得改变估算结果：这里用含 CJK / emoji / 数学符号 / URL / 数字的
// 混合样本，对同一输入分别走缓存路径与未缓存路径，结果必须一致。
func TestEstimateAITextTokensForProfileStableWithCache(t *testing.T) {
	sample := "部署 nginx ∑∫∂≤≥≠ 到 192.168.1.10:/etc/nginx?a=1&b=2#top\n第二行 🎉🎉 12345 abcdef"
	profile := AIProviderProfile{Model: "gpt-4o-mini"}

	first := estimateAITextTokensForProfile(sample, profile)
	second := estimateAITextTokensForProfile(sample, profile)
	uncached := estimateAITextTokensUncached(sample, normalizeAITokenEstimatorModel(profile.Model))
	if first != second || first != uncached {
		t.Fatalf("缓存前后结果不一致: 首次=%d 再次=%d 未缓存=%d", first, second, uncached)
	}
	if first <= 0 {
		t.Fatalf("样本 token 数应大于 0, 实际 %d", first)
	}

	// 不同模型必须分开缓存
	otherProfile := AIProviderProfile{Model: "claude-3-5-sonnet"}
	other := estimateAITextTokensForProfile(sample, otherProfile)
	otherUncached := estimateAITextTokensUncached(sample, normalizeAITokenEstimatorModel(otherProfile.Model))
	if other != otherUncached {
		t.Fatalf("换模型后结果不一致: 缓存=%d 未缓存=%d", other, otherUncached)
	}

	// 空文本与超长文本不进缓存，但结果仍然正确
	if got := estimateAITextTokensForProfile("", profile); got != 0 {
		t.Fatalf("空文本 token 数应为 0, 实际 %d", got)
	}
	longSample := strings.Repeat("工具输出一行内容 ", aiTextTokenCacheMaxTextLen/8+10)
	longFirst := estimateAITextTokensForProfile(longSample, profile)
	longSecond := estimateAITextTokensForProfile(longSample, profile)
	if longFirst != longSecond {
		t.Fatalf("超长文本两次估算不一致: %d vs %d", longFirst, longSecond)
	}
}

func TestIsAITokenEstimatorMathSymbolCoversConstantRunes(t *testing.T) {
	for _, symbol := range aiTokenEstimatorMathSymbolRunes {
		if !isAITokenEstimatorMathSymbol(symbol) {
			t.Fatalf("数学符号 %q 未被识别", symbol)
		}
	}
	if isAITokenEstimatorMathSymbol('a') || isAITokenEstimatorMathSymbol('中') {
		t.Fatal("普通字母/汉字不应被判为数学符号")
	}
}
