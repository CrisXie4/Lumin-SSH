package platformupdate

import (
	"net/url"
	"strings"
)

// IsAllowedDownloadURL 仅允许 GitHub Release 资产下载直链。
// 精确校验 host（github.com 及其子域），拒绝任意 host 携带 github.com 路径的绕过构造；
// 镜像前缀由 UpdateApp 在校验通过后内部拼接，不经过本函数。
// 拒绝 html_url / 网页 / 非 download 路径，避免把 Release 页面当安装包热替换。
func IsAllowedDownloadURL(raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host != "github.com" && !strings.HasSuffix(host, ".github.com") {
		return false
	}
	path := strings.ToLower(u.Path)
	if !strings.Contains(path, "/releases/download/") {
		return false
	}
	return !strings.HasSuffix(path, ".sha256")
}

// IsAllowedFilename 校验更新文件名是否为受支持的安装包格式。
func IsAllowedFilename(filename string) bool {
	name := strings.ToLower(strings.TrimSpace(filename))
	if name == "" || name == "." || name == ".." {
		return false
	}
	if strings.HasSuffix(name, ".sha256") {
		return false
	}
	return strings.HasSuffix(name, ".exe") ||
		strings.HasSuffix(name, ".deb") ||
		strings.HasSuffix(name, ".rpm") ||
		strings.HasSuffix(name, ".dmg")
}
