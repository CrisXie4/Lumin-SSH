# RPM 构建规格：Lumin SSH Client
# 由 CI 用 rpmbuild 原生构建，不依赖 alien 转换。
# CI 把 VERSION 按 rpm 规则拆成 lum_version / lum_release 注入。

Name:           lumin
Version:        %{lum_version}
Release:        %{lum_release}%{?dist}
Summary:        Lightweight SSH Client
License:        proprietary
URL:            https://github.com/wmwlwmwl/Lumin-SSH
Packager:       Lumin <admin@662662.xyz>
# rpm 依赖用较通用的包名（覆盖 Fedora/openSUSE 等）。
Requires:       gtk3
Requires:       webkit2gtk3
Requires:       glib2
Requires:       libayatana-appindicator
BuildArch:      x86_64

%description
A modern, lightweight SSH client built with Wails.
Quickly manage and connect to your SSH servers.

%install
install -D -m 0755 %{_sourcedir}/Lumin %{buildroot}%{_bindir}/lumin
install -D -m 0644 %{_sourcedir}/appicon.png %{buildroot}%{_datadir}/icons/hicolor/256x256/apps/lumin.png
install -D -m 0644 %{_sourcedir}/lumin.desktop %{buildroot}%{_datadir}/applications/lumin.desktop

%files
%{_bindir}/lumin
%{_datadir}/icons/hicolor/256x256/apps/lumin.png
%{_datadir}/applications/lumin.desktop

# 等价于 deb 的 postinst：安装后刷新桌面数据库与图标缓存
%post
update-desktop-database -q %{_datadir}/applications || :
gtk-update-icon-cache -q %{_datadir}/icons/hicolor || :

# 等价于 deb 的 postrm：卸载后刷新
%postun
update-desktop-database -q %{_datadir}/applications || :
gtk-update-icon-cache -q %{_datadir}/icons/hicolor || :

%changelog
* Thu Aug 7 2026 Lumin <admin@662662.xyz> - 1.0.0-1
- Initial RPM build via rpmbuild (replaces alien conversion).
