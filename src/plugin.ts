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
      importFile(payload);
      break;
    case UIActionTypes.EXPORT:
      exportFile();
      break;
  }
};

let thisNode = (null as unknown) as string;

figma.on('selectionchange', async () => {
  if (!figma.currentPage.selection[0]) return;
  const id = figma.currentPage.selection[0].id;
  const node = figma.getNodeById(id);
  if (!node || node.type !== 'TEXT') {
    postMessage({
      type: WorkerActionTypes.SELECTED_NODE,
      payload: { id: id, type: node?.type, contents: null },
    });
    return;
  }
  const rangeFontNames = [] as FontName[];
  for (let i = 0; i < node.characters.length; i++) {
    const fontName = node.getRangeFontName(i, i + 1) as FontName;
    if (
      rangeFontNames.some(
        (name) => name.family === fontName.family && name.style === fontName.style,
      )
    )
      continue;
    rangeFontNames.push(node.getRangeFontName(i, i + 1) as FontName);
  }

  postMessage({ type: WorkerActionTypes.SET_FONT_LOAD_STATUS, payload: false });
  await Promise.all(rangeFontNames.map((name) => figma.loadFontAsync(name)));
  postMessage({ type: WorkerActionTypes.SET_FONT_LOAD_STATUS, payload: true });

  const styles = getStyle(id);
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const defaultContents = langList.reduce((acc: any, lang: LangType) => {
    acc[lang.id.toString()] = {
      characters: node.characters,
      style: styles.style,
      characterStyleOverrides: styles.characterStyleOverrides,
      styleOverrideTable: styles.styleOverrideTable,
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
    if (nowNodeLang !== parseInt(figma.currentPage.getPluginData('globalLang')))
      node.characters = nodeInfo.nodeContents[nowNodeLang].characters;
    thisNode = id;
  }

  nodeInfo.nodeContents[nowNodeLang].characters = node.characters;
  node.setPluginData('nodeInfo', JSON.stringify(nodeInfo));

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

async function ApplyGlobalLang(globalLang: number) {
  const textNodeList = JSON.parse(figma.currentPage.getPluginData('textNodeList'));
  figma.currentPage.setPluginData('globalLang', globalLang.toString());
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const rangeFontNames = [] as FontName[];
  textNodeList.map(async (textNodeId: string) => {
    const node = <TextNode>figma.getNodeById(textNodeId);
    if (node?.characters) {
      for (let i = 0; i < node.characters.length; i++) {
        const fontName = node.getRangeFontName(i, i + 1) as FontName;
        if (
          rangeFontNames.some(
            (name) => name.family === fontName.family && name.style === fontName.style,
          )
        )
          continue;
        rangeFontNames.push(node.getRangeFontName(i, i + 1) as FontName);
      }
    }
  });
  postMessage({ type: WorkerActionTypes.SET_FONT_LOAD_STATUS, payload: false });
  await Promise.all(rangeFontNames.map((name) => figma.loadFontAsync(name)));
  postMessage({ type: WorkerActionTypes.SET_FONT_LOAD_STATUS, payload: true });
  console.log(rangeFontNames);
  textNodeList.map(async (textNodeId: string) => {
    const node = <TextNode>figma.getNodeById(textNodeId);
    if (node?.characters) {
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
    }
  });
}

async function SetNodeNowLang(payload: any) {
  if (!figma.currentPage.selection[0]) return;
  const newNodeInfo = JSON.parse(figma.currentPage.selection[0].getPluginData('nodeInfo'));
  const node = <TextNode>figma.currentPage.selection[0];

  const rangeFontNames = [] as FontName[];
  for (let i = 0; i < node.characters.length; i++) {
    const fontName = node.getRangeFontName(i, i + 1) as FontName;
    if (
      rangeFontNames.some(
        (name) => name.family === fontName.family && name.style === fontName.style,
      )
    )
      continue;
    rangeFontNames.push(node.getRangeFontName(i, i + 1) as FontName);
  }
  postMessage({ type: WorkerActionTypes.SET_FONT_LOAD_STATUS, payload: false });
  await Promise.all(rangeFontNames.map((name) => figma.loadFontAsync(name)));
  postMessage({ type: WorkerActionTypes.SET_FONT_LOAD_STATUS, payload: true });

  newNodeInfo.nowLangId = payload;
  node.characters = newNodeInfo.nodeContents[`${payload}`].characters;
  figma.currentPage.selection[0].setPluginData('nodeInfo', JSON.stringify(newNodeInfo));

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

interface StyleType {
  fontSize?: number;
  fontName?: FontName;
  textCase?: TextCase;
  textDecoration?: TextDecoration;
  letterSpacing?: LetterSpacing;
  lineHeight?: LineHeight;
}

interface StyleOverridesType {
  [key: string]: any;
}

function getStyle(id: string) {
  const node = <TextNode>figma.getNodeById(id);
  let defaultStyle = {
    fontSize: node.fontSize !== figma.mixed ? node.fontSize : ((null as unknown) as number),
    fontName: node.fontName !== figma.mixed ? node.fontName : ((null as unknown) as FontName),
    textCase: node.textCase !== figma.mixed ? node.textCase : ((null as unknown) as TextCase),
    textDecoration:
      node.textDecoration !== figma.mixed
        ? node.textDecoration
        : ((null as unknown) as TextDecoration),
    letterSpacing:
      node.letterSpacing !== figma.mixed
        ? node.letterSpacing
        : ((null as unknown) as LetterSpacing),
    lineHeight:
      node.lineHeight !== figma.mixed ? node.lineHeight : ((null as unknown) as LineHeight),
  } as StyleType;
  let characterStyleOverrides = [];
  let styleOverrideTable = {} as StyleOverridesType;
  let tableIndexAll = 0;
  for (let i = 0; i < node.characters.length; i++) {
    const style = {} as StyleType;
    if (!defaultStyle.fontSize) style.fontSize = <number>node.getRangeFontSize(i, i + 1);
    if (!defaultStyle.fontName) style.fontName = <FontName>node.getRangeFontName(i, i + 1);
    if (!defaultStyle.textCase) style.textCase = <TextCase>node.getRangeTextCase(i, i + 1);
    if (!defaultStyle.textDecoration)
      style.textDecoration = <TextDecoration>node.getRangeTextDecoration(i, i + 1);
    if (!defaultStyle.letterSpacing)
      style.letterSpacing = <LetterSpacing>node.getRangeLetterSpacing(i, i + 1);
    if (!defaultStyle.lineHeight) style.lineHeight = <LineHeight>node.getRangeLineHeight(i, i + 1);
    let tableIndex = Object.keys(styleOverrideTable).findIndex((key) => {
      return (
        JSON.stringify(Object.entries(styleOverrideTable[key])) ===
        JSON.stringify(Object.entries(style))
      );
    });
    if (tableIndex != -1) characterStyleOverrides.push(tableIndex);
    else {
      characterStyleOverrides.push(tableIndexAll);
      styleOverrideTable[tableIndexAll] = style;
      tableIndexAll++;
    }
  }
  return {
    style: defaultStyle,
    characterStyleOverrides: characterStyleOverrides,
    styleOverrideTable: styleOverrideTable,
  };
}

function exportFile() {
  const textNodeList = JSON.parse(figma.currentPage.getPluginData('textNodeList'));
  const langList = JSON.parse(figma.currentPage.getPluginData('langList'));
  const exportMap = {
    languages: langList,
    textNodeList,
    i18n: textNodeList.reduce((prevObject: Object, textNodeId: string) => {
      const node = <TextNode>figma.getNodeById(textNodeId);
      const { nodeContents } = JSON.parse(node.getPluginData('nodeInfo'));
      return {
        ...prevObject,
        [textNodeId]: nodeContents,
      };
    }, {}),
  };
  console.log('exportAll', exportMap);
  postMessage({ type: WorkerActionTypes.EXPORT, payload: JSON.stringify(exportMap) });
}

async function importFile(payload: string) {
  const { content, currentLang } = JSON.parse(payload);
  const { textNodeList, i18n, languages, globalLang } = JSON.parse(content);
  figma.currentPage.setPluginData('textNodeList', JSON.stringify(textNodeList));
  figma.currentPage.setPluginData('globalLang', `${languages[0].id}`);
  figma.currentPage.setPluginData('langList', JSON.stringify(languages));
  figma.currentPage.setPluginData('lang-id-index', `${languages.length}`);
  const rangeFontNames = [] as FontName[];

  languages.map(async ({ id }: any) =>
    textNodeList.map(async (textNodeId: string) => {
      const node = <TextNode>figma.getNodeById(textNodeId);
      if (node?.characters) {
        for (let i = 0; i < node.characters.length; i++) {
          const fontName = node.getRangeFontName(i, i + 1) as FontName;
          if (
            rangeFontNames.some(
              (name) => name.family === fontName.family && name.style === fontName.style,
            )
          )
            continue;
          rangeFontNames.push(node.getRangeFontName(i, i + 1) as FontName);
        }
        const nodeInfo = { nodeContents: i18n[textNodeId], nowLangId: id };
        node.setPluginData('nodeInfo', JSON.stringify(nodeInfo));
      }
      /* 여기서 뭔가 스타일 적용 같은 게 되야할 것 같은 느낌은 TODO? */
    }),
  );
  postMessage({ type: WorkerActionTypes.SET_FONT_LOAD_STATUS, payload: false });
  await Promise.all(rangeFontNames.map((name) => figma.loadFontAsync(name)));
  postMessage({ type: WorkerActionTypes.SET_FONT_LOAD_STATUS, payload: true });
  ApplyGlobalLang(currentLang);
}
// Show the plugin interface (https://www.figma.com/plugin-docs/creating-ui/)
// Remove this in case your plugin doesn't need a UI, make network requests, use browser APIs, etc.
// If you need to make network requests you need an invisible UI (https://www.figma.com/plugin-docs/making-network-requests/)
figma.showUI(__html__, { width: 450, height: 600 });
