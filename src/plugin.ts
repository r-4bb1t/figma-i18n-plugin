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
      ApplyGlobalLang(payload);
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
    case UIActionTypes.IMPORT:
      console.log("IMPORT CSV", payload);
      break;
    case UIActionTypes.EXPORT:
      exportFile();
      break;
  }
};

let thisNode = (null as unknown) as string;

figma.on('selectionchange', async () => {
  const id = figma.currentPage.selection[0]?.id;
  if (!id) return;
  const node = figma.getNodeById(id);
  if (!node || node.type !== 'TEXT') {
    postMessage({
      type: WorkerActionTypes.SELECTED_NODE,
      payload: { id: id, type: node?.type, contents: null },
    });
    return;
  }

  const rangeFontNames = [] as FontName[];
  let flag = false;
  for (let i = 0; i < node.characters.length; i++) {
    const fontName = node.getRangeFontName(i, i + 1) as FontName;
    if (rangeFontNames.some((name) => name.family === fontName.family)) continue;
    rangeFontNames.push(node.getRangeFontName(i, i + 1) as FontName);
    flag = true;
  }
  if (flag) await Promise.all(rangeFontNames.map((name) => figma.loadFontAsync(name)));

  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const defaultContents = langList.reduce((acc: any, lang: LangType) => {
    acc[lang.id.toString()] = {
      characters: node.characters,
      style: {},
      characterStyleOverrides: {},
    };
    return acc;
  }, {});
  if (!node.getPluginData('nodeInfo')) {
    node.setPluginData(
      'nodeInfo',
      JSON.stringify({
        nowLangId: figma.currentPage.getPluginData('globalLang'),
        nodeContents: defaultContents,
      }),
    );
    const nodeInfo = JSON.parse(node.getPluginData('nodeInfo'));
    const nowNodeLang = parseInt(nodeInfo.nowLangId);
    const nodeContents = nodeInfo.nodeContents;
    let contents = {
      characters: node.characters || null,
      nowNodeLang: nowNodeLang,
      nodeContents: nodeContents,
    };
    postMessage({
      type: WorkerActionTypes.SELECTED_NODE,
      payload: { id: id, type: node?.type || null, contents: contents },
    });
  }

  const nodeInfo = JSON.parse(node.getPluginData('nodeInfo'));
  const nowNodeLang = parseInt(nodeInfo.nowLangId);
  const nodeContents = nodeInfo.nodeContents;
  let contents = {
    characters: node.characters || null,
    nowNodeLang: nowNodeLang,
    nodeContents: nodeContents,
  };

  if (thisNode !== id) {
    node.characters = nodeInfo.nodeContents[nowNodeLang].characters;
    thisNode = id;
  }
  nodeInfo.nodeContents[nowNodeLang].characters = node.characters;
  figma.currentPage.selection[0]!.setPluginData('nodeInfo', JSON.stringify(nodeInfo));

  postMessage({
    type: WorkerActionTypes.SELECTED_NODE,
    payload: { id: id, type: node?.type || null, contents: contents },
  });
});

figma.on('currentpagechange', () => Init());

function getTextNode(root: BaseNode) {
  if (
    root.type === 'RECTANGLE' ||
    root.type === 'SLICE' ||
    root.type === 'VECTOR' ||
    root.type === 'STAR' ||
    root.type === 'LINE' ||
    root.type === 'ELLIPSE' ||
    root.type === 'POLYGON'
  )
    return [];
  if (root.type === 'TEXT') return [root.id];
  let textChild = [] as string[];
  for (let child of root.children) textChild = textChild.concat(getTextNode(child));
  return textChild;
}

async function Init() {
  if (!figma.currentPage.getPluginData('langList'))
    figma.currentPage.setPluginData('langList', `[{ "id": 0, "name": "default" }]`);
  const textNodeList = getTextNode(figma.currentPage);
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
  figma.currentPage.setPluginData('langList', JSON.stringify(newLangList));
}

function DeleteLang(id: number) {
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const newLangList = langList.filter((item: any) => item.id !== id);
  figma.currentPage.setPluginData('langList', JSON.stringify(newLangList));
}

function ApplyGlobalLang(globalLang: number) {
  console.log(globalLang);
  const textNodeList = JSON.parse(figma.currentPage.getPluginData('textNodeList'));
  figma.currentPage.setPluginData('globalLang', globalLang.toString());
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const rangeFontNames = [] as FontName[];
  textNodeList.map(async (textNodeId: string) => {
    const node = <TextNode>figma.getNodeById(textNodeId);
    let flag = false;
    for (let i = 0; i < node.characters.length; i++) {
      const fontName = node.getRangeFontName(i, i + 1) as FontName;
      if (rangeFontNames.some((name) => name.family === fontName.family)) continue;
      rangeFontNames.push(node.getRangeFontName(i, i + 1) as FontName);
      flag = true;
    }
    if (flag) await Promise.all(rangeFontNames.map((name) => figma.loadFontAsync(name)));
    if (!node.getPluginData('nodeInfo')) {
      const defaultContents = langList.reduce((acc: any, lang: LangType) => {
        acc[lang.id.toString()] = {
          characters: node.characters,
          style: {},
          characterStyleOverrides: {},
        };
        return acc;
      }, {});
      node.setPluginData(
        'nodeInfo',
        JSON.stringify({
          nowLangId: figma.currentPage.getPluginData('globalLang'),
          nodeContents: defaultContents,
        }),
      );
    }
    const nodeInfo = JSON.parse(node.getPluginData('nodeInfo'));
    nodeInfo.nowLangId = globalLang;
    node.setPluginData('nodeInfo', JSON.stringify(nodeInfo));
    node.characters = nodeInfo.nodeContents[globalLang].characters;
  });
}

function SetNodeNowLang(payload: any) {
  const newNodeInfo = JSON.parse(figma.currentPage.selection[0]!.getPluginData('nodeInfo'));
  const node = <TextNode>figma.currentPage.selection[0];
  newNodeInfo.nowLangId = payload;
  node.characters = newNodeInfo.nodeContents[`${payload}`].characters;
  figma.currentPage.selection[0]!.setPluginData('nodeInfo', JSON.stringify(newNodeInfo));

  const nodeContents = newNodeInfo.nodeContents;
  let contents = {
    characters: node.characters || null,
    nowNodeLang: payload,
    nodeContents: nodeContents,
  };

  postMessage({
    type: WorkerActionTypes.SELECTED_NODE,
    payload: { id: node.id, type: node.type || null, contents: contents },
  });
}

function exportFile() {
  const textNodeList = JSON.parse(figma.currentPage.getPluginData('textNodeList'));
  const globalLang = figma.currentPage.getPluginData('globalLang');
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const rangeFontNames = [] as FontName[];
  const exportMap = textNodeList.reduce((prevObject: Object, textNodeId: string) => {
    const node = <TextNode>figma.getNodeById(textNodeId);
    const {nodeContents} = JSON.parse(node.getPluginData('nodeInfo'));
    return {
      ...prevObject,
      [textNodeId]: nodeContents
    }
  }, {});
  console.log("exportAll", exportMap);
  const blob = new Blob([JSON.stringify(exportMap)], {type: 'application/json'});
  const anchor = document.createElement('a');
  anchor.setAttribute('href', window.URL.createObjectURL(blob));
  anchor.setAttribute('download', "i18n.json");
  anchor.click();
}

// Show the plugin interface (https://www.figma.com/plugin-docs/creating-ui/)
// Remove this in case your plugin doesn't need a UI, make network requests, use browser APIs, etc.
// If you need to make network requests you need an invisible UI (https://www.figma.com/plugin-docs/making-network-requests/)
figma.showUI(__html__, { width: 450, height: 600 });
