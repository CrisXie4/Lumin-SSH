package mcp

const embeddedFirecrawlServerName = "firecrawl"

const embeddedFirecrawlServerURL = "https://mcp.firecrawl.dev/v2/mcp"

func LoadEmbeddedServerSettings(configDir string) StoredServerSettings {
	embeddedSettings := LoadEmbeddedServerConfigSettings(configDir)
	settings := StoredServerSettings{
		McpServers: map[string]ServerConfig{
			"超级内容": {
				Type: ServerTransportStreamableHTTP,
				URL:  "https://mcp.context7.com/mcp",
				AlwaysAllow: []string{
					"*",
				},
				Timeout: 0,
			},
			embeddedFirecrawlServerName: {
				Type: ServerTransportStreamableHTTP,
				URL:  embeddedFirecrawlServerURL,
				Headers: map[string]string{
					"Authorization": "Bearer " + embeddedSettings.FirecrawlAPIKey,
				},
				AlwaysAllow: []string{
					"*",
				},
				Timeout: 0,
			},
		},
		ServerOrder: []string{"超级内容", embeddedFirecrawlServerName},
	}
	return NormalizeStoredServerSettings(settings)
}