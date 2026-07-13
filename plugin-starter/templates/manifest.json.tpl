{
  "Name": "{{PLUGIN_NAME}}",
  "Version": "1.0.0",
  "Author": "{{AUTHOR}}",
  "Description": "{{DESCRIPTION}}",
  "Category": "{{CATEGORY}}",
  "Icon": "icon",
  "URL": "https://github.com/{{OWNER}}/{{REPO_NAME}}",
  "Actions": [
    {
      "Name": "{{PLUGIN_NAME}} Action",
      "UUID": "{{PLUGIN_ID}}.action",
      "Icon": "icon",
      "Controllers": [
{{CONTROLLERS}}
      ],
      "PropertyInspectorPath": "pi/index.html",
      "States": [
        {
          "Image": "icon"
        }
      ],
      "Tooltip": "{{PLUGIN_NAME}}"
    }
  ],
  "OS": [
    {
      "Platform": "mac",
      "MinVersion": "10.15"
    },
    {
      "Platform": "windows",
      "MinVersion": "10"
    }
  ],
  "Software": {
    "MinVersion": "1.0.0"
  },
  "CodePath": "app.js"
}
