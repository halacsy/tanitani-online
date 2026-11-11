import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

test('image and Markdown widgets resolve draft assets through their repository folder', async () => {
  const widgets = {}, templates = {}
  const field = { set(key, value) { return { ...this, [key]: value } } }
  const context = {
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    h: (component, props) => ({ component, props }),
    createClass: value => value,
    CMS: {
      getWidget: () => ({ control: 'control', preview: 'preview' }),
      registerWidget: (name, control, preview) => { widgets[name] = { control, preview } },
      registerPreviewTemplate: (name, value) => { templates[name] = value },
      registerEditorComponent() {}, registerPreviewStyle() {},
    },
  }
  await vm.runInNewContext(fs.readFileSync('public/admin/preview.js', 'utf8'), context)
  for (const widget of Object.values(widgets)) {
    for (const Component of Object.values(widget)) {
      const wrapped = Component({ field, getAsset: (value, config) => ({ value, config }) })
      const draft = wrapped.props.getAsset('/images/cikkek/a.png')
      assert.equal(draft.value, 'a.png')
      assert.equal(draft.config.media_folder, '/public/images/cikkek')
      assert.equal(wrapped.props.getAsset('/sites/default/files/a.png').value, '/sites/default/files/a.png')
      assert.equal(wrapped.props.getAsset('https://example.com/a.png').value, 'https://example.com/a.png')
    }
  }
  assert.ok(templates.szerzok)
})
