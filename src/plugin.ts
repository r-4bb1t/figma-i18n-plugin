import { UIActionTypes, UIAction, WorkerActionTypes, WorkerAction, LangType } from './types';

// Sends a message to the plugin UI
function postMessage({ type, payload }: WorkerAction): void {
  figma.ui.postMessage({ type, payload });
}

// Creates a rectangle (demo purposes)
function createRectangle(): void {
  const rect = figma.createRectangle();
  const width = 100;
  const height = 100;

  rect.resize(width, height);
  rect.x = figma.viewport.center.x - Math.round(width / 2);
  rect.y = figma.viewport.center.y - Math.round(height / 2);
  figma.currentPage.appendChild(rect);
  figma.currentPage.selection = [rect];
  figma.viewport.scrollAndZoomIntoView([rect]);

  postMessage({ type: WorkerActionTypes.CREATE_RECTANGLE_NOTIFY, payload: 'Rectangle created 👍' });
}

// Listen to messages received from the plugin UI (src/ui/ui.ts)
figma.ui.onmessage = function ({ type, payload }: UIAction): void {
  switch (type) {
    case UIActionTypes.INIT:
      Init();
      break;
    case UIActionTypes.CLOSE:
      figma.closePlugin();
      break;
    case UIActionTypes.NOTIFY:
      payload && figma.notify(payload);
      break;
    case UIActionTypes.APPLY_GLOBAL_LANG:
      break;
    case UIActionTypes.ADD_LANG:
      AddLang();
      break;
    case UIActionTypes.EDIT_LANG:
      EditLang(payload);
      break;
    case UIActionTypes.DELETE_LANG:
      DeleteLang(payload);
      break;
    case UIActionTypes.SET_NODE_NOW_LANG:
      SetNodeNowLang(payload);
      break;
    case UIActionTypes.SET_PLUGIN_DATA:
      figma
        .getNodeById(figma.currentPage.selection[0].id)
        ?.setPluginData('hi', new Date().toString());
      break;
    case UIActionTypes.GET_PLUGIN_DATA:
      console.log(figma.getNodeById(figma.currentPage.selection[0].id)?.getPluginData('hi'));
      break;
  }
};

figma.on('selectionchange', async () => {
  const id = figma.currentPage.selection[0].id;
  const node = figma.getNodeById(id);
  if (!node || node.type !== 'TEXT') {
    postMessage({
      type: WorkerActionTypes.SELECTED_NODE,
      payload: { id: id, type: node?.type, contents: null },
    });
    return;
  }
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  if (!node.getPluginData('nodeInfo'))
    node.setPluginData(
      'nodeInfo',
      JSON.stringify({
        nowLangId: figma.currentPage.getPluginData('globalLang'),
        nodeContents: langList.map((lang: LangType) => {
          return {
            [lang.id.toString()]: {
              characters: node.characters,
              style: {},
              characterStyleOverrides: {},
            },
          };
        }),
      }),
    );
  const nodeInfo = JSON.parse(node.getPluginData('nodeInfo'));
  const nowNodeLang = parseInt(nodeInfo.nowLangId);
  const nodeContents = nodeInfo.nodeContents;
  /**/
  let contents = {
    characters: node.characters || null,
    nowNodeLang: nowNodeLang,
    nodeContents: nodeContents,
  };
  postMessage({
    type: WorkerActionTypes.SELECTED_NODE,
    payload: { id: id, type: node?.type || null, contents: contents },
  });
});

figma.on('currentpagechange', () => Init());

function Init() {
  if (!figma.currentPage.getPluginData('langList'))
    figma.currentPage.setPluginData('langList', `[{ "id": 0, "name": "default" }]`);
  const textNodeList = figma.currentPage.children
    .filter((node) => node.type === 'TEXT')
    .map((textNode) => textNode.id);
  figma.currentPage.setPluginData('textNodeList', JSON.stringify(textNodeList));
  if (!figma.currentPage.getPluginData('globalLang'))
    figma.currentPage.setPluginData(
      'globalLang',
      JSON.parse(figma.currentPage.getPluginData('langList'))[0].id.toString(),
    );
  const data = {
    langList: JSON.parse(figma.currentPage.getPluginData('langList')),
    globalLang: parseInt(figma.currentPage.getPluginData('globalLang')),
  };
  postMessage({ type: WorkerActionTypes.INIT, payload: data });
}

function AddLang() {
  const id = parseInt(figma.currentPage.getPluginData('lang-id-index')) + 1 || 1;
  figma.currentPage.setPluginData('lang-id-index', id.toString());
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  langList.push({ id: id, name: `lang(${id})` });
  figma.currentPage.setPluginData('langList', JSON.stringify(langList));
  postMessage({ type: WorkerActionTypes.ADD_LANG, payload: id });
}

function EditLang(payload: any) {
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const newLangList = langList.map((item: any) => {
    if (item.id === payload.id) return { id: item.id, name: payload.name };
    return item;
  });
  console.log(newLangList);
  figma.currentPage.setPluginData('langList', JSON.stringify(newLangList));
}

function DeleteLang(id: number) {
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const newLangList = langList.filter((item: any) => item.id !== id);
  figma.currentPage.setPluginData('langList', JSON.stringify(newLangList));
}

function SetNodeNowLang(payload: any) {
  const newNodeInfo = JSON.parse(figma.currentPage.selection[0]!.getPluginData('nodeInfo'));
  newNodeInfo.nowLangId = payload;
  figma.currentPage.selection[0]!.setPluginData('nodeInfo', JSON.stringify(newNodeInfo));
}

// Show the plugin interface (https://www.figma.com/plugin-docs/creating-ui/)
// Remove this in case your plugin doesn't need a UI, make network requests, use browser APIs, etc.
// If you need to make network requests you need an invisible UI (https://www.figma.com/plugin-docs/making-network-requests/)
figma.showUI(__html__, { width: 450, height: 600 });
