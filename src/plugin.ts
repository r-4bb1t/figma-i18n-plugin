import { UIActionTypes, UIAction, WorkerActionTypes, WorkerAction, LangType } from './types';

function postMessage({ type, payload }: WorkerAction): void {
  figma.ui.postMessage({ type, payload });
}

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
    case UIActionTypes.IMPORT:
      importFile(payload);
      break;
    case UIActionTypes.EXPORT:
      exportFile();
      break;
  }
};

let thisNode = (null as unknown) as string;
let styleStatus = 0;

async function handleSelection(id: string) {
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
  const langList = JSON.parse(figma.root.getPluginData('langList'));
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
        nowLangId: figma.root.getPluginData('globalLang'),
        nodeContents: defaultContents,
      }),
    );

    const nodeInfo = JSON.parse(node.getPluginData('nodeInfo'));
    const nowNodeLang = parseInt(nodeInfo.nowLangId);
    const nodeContents = nodeInfo.nodeContents;
    const contents = {
      characters: node.characters || null,
      nowNodeLang:
        langList.filter((lang: any) => lang.id === nowNodeLang).length > 0
          ? nowNodeLang
          : figma.root.getPluginData('globalLang'),
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
  const contents = {
    characters: node.characters || null,
    nowNodeLang: nowNodeLang,
    nodeContents: nodeContents,
  };

  if (thisNode !== id) {
    if (nowNodeLang !== parseInt(figma.root.getPluginData('globalLang'))) {
      node.characters = nodeInfo.nodeContents[nowNodeLang].characters;
      styleStatus += 1;
      setStyle(
        id,
        nodeInfo.nodeContents[nowNodeLang].style,
        nodeInfo.nodeContents[nowNodeLang].characterStyleOverrides,
        nodeInfo.nodeContents[nowNodeLang].styleOverrideTable,
      );
    }
    thisNode = id;
  }

  nodeInfo.nodeContents = { ...nodeInfo.nodeContents, [nowNodeLang]: {} };

  nodeInfo.nodeContents[nowNodeLang].characters = node.characters;
  nodeInfo.nodeContents[nowNodeLang].style = styles.style;
  nodeInfo.nodeContents[nowNodeLang].characterStyleOverrides = styles.characterStyleOverrides;
  nodeInfo.nodeContents[nowNodeLang].styleOverrideTable = styles.styleOverrideTable;
  node.setPluginData('nodeInfo', JSON.stringify(nodeInfo));

  postMessage({
    type: WorkerActionTypes.SELECTED_NODE,
    payload: { id: id, type: node?.type || null, contents: contents },
  });
}

figma.on('selectionchange', async () => {
  if (styleStatus > 0) return;
  figma.currentPage?.selection.map((select) => {
    if (select.id) handleSelection(select.id);
  });
});

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
  for (const child of root.children) textChild = textChild.concat(getTextNode(child));
  return textChild;
}

async function Init() {
  if (!figma.root.getPluginData('langList'))
    figma.root.setPluginData('langList', `[{ "id": 0, "name": "default" }]`);
  const textNodeList = getTextNode(figma.currentPage);
  figma.root.setPluginData('textNodeList', JSON.stringify(textNodeList));
  if (!figma.root.getPluginData('globalLang'))
    figma.root.setPluginData(
      'globalLang',
      JSON.parse(figma.root.getPluginData('langList'))[0].id.toString(),
    );
  const data = {
    langList: JSON.parse(figma.root.getPluginData('langList')),
    globalLang: parseInt(figma.root.getPluginData('globalLang')),
  };
  const id = figma.currentPage.selection[0]?.id;
  if (id) handleSelection(id);
  postMessage({ type: WorkerActionTypes.INIT, payload: data });
}

function AddLang() {
  const id = parseInt(figma.root.getPluginData('lang-id-index')) + 1 || 1;
  figma.root.setPluginData('lang-id-index', id.toString());
  const langList = JSON.parse(figma.root.getPluginData('langList'));
  langList.push({ id: id, name: `lang(${id})` });
  figma.root.setPluginData('langList', JSON.stringify(langList));
  postMessage({ type: WorkerActionTypes.ADD_LANG, payload: id });
}

function EditLang(payload: any) {
  const langList = JSON.parse(figma.root.getPluginData('langList'));
  const newLangList = langList.map((item: any) => {
    if (item.id === payload.id) return { id: item.id, name: payload.name };
    return item;
  });
  figma.root.setPluginData('langList', JSON.stringify(newLangList));
}

function DeleteLang(id: number) {
  const langList = JSON.parse(figma.root.getPluginData('langList'));
  const globalLang = parseInt(figma.root.getPluginData('globalLang'));
  const newLangList = langList.filter((item: any) => item.id !== id);
  const newGlobalLang = id === globalLang ? newLangList[0] : globalLang;
  if (id === globalLang) {
    figma.root.setPluginData('globalLang', newGlobalLang.toString());
  }
  figma.root.setPluginData('langList', JSON.stringify(newLangList));
  ApplyGlobalLang(newGlobalLang, id);
}

async function ApplyGlobalLang(globalLang: number, selectLang?: number) {
  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'font', status: false },
  });
  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'text', status: false },
  });
  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'style', status: false },
  });
  const textNodeList = selectLang
    ? getTextNode(figma.currentPage).filter(
        (id: string) =>
          JSON.parse((<TextNode>figma.getNodeById(id))?.getPluginData('nodeInfo')).nowLangId ===
          selectLang,
      )
    : getTextNode(figma.currentPage);
  styleStatus += textNodeList.length;
  if (textNodeList.length === 0) {
    postMessage({
      type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
      payload: { id: 'style', status: true },
    });
  }
  figma.root.setPluginData('globalLang', globalLang.toString());
  const langList = JSON.parse(figma.root.getPluginData('langList'));
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
  await Promise.all(rangeFontNames.map((name) => figma.loadFontAsync(name)));
  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'font', status: true },
  });
  textNodeList.map((textNodeId: string) => {
    const node = <TextNode>figma.getNodeById(textNodeId);
    if (node?.characters) {
      if (!node.getPluginData('nodeInfo')) {
        const defaultContents = langList.reduce((acc: any, lang: LangType) => {
          acc[lang.id.toString()] = {
            characters: node.characters,
            style: getStyle(textNodeId),
            characterStyleOverrides: {},
          };
          return acc;
        }, {});
        node.setPluginData(
          'nodeInfo',
          JSON.stringify({
            nowLangId: globalLang,
            nodeContents: defaultContents,
          }),
        );
      }
      const nodeInfo = JSON.parse(node.getPluginData('nodeInfo'));
      if (selectLang && nodeInfo.nowLangId !== selectLang) return;
      nodeInfo.nowLangId = globalLang;
      node.characters = nodeInfo.nodeContents[globalLang]?.characters || node.characters;
      node.setPluginData(
        'nodeInfo',
        JSON.stringify({
          nowLangId: globalLang,
          nodeContents: Object.keys(nodeInfo.nodeContents)
            .filter(
              (id: string) => langList.filter((lang: any) => lang.id === parseInt(id)).length > 0,
            )
            .reduce((obj: any, key: string) => {
              obj[key] = nodeInfo.nodeContents[key];
              return obj;
            }, {}),
        }),
      );
      setStyle(
        textNodeId,
        nodeInfo.nodeContents[globalLang]?.style || getDefaultStyle(textNodeId),
        nodeInfo.nodeContents[globalLang]?.characterStyleOverrides,
        nodeInfo.nodeContents[globalLang]?.styleOverrideTable,
      );
    }
  });
  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'text', status: true },
  });
}

async function SetNodeNowLang(payload: any) {
  if (!figma.currentPage.selection[0]) return;
  const node = <TextNode>figma.currentPage.selection[0];
  const newNodeInfo = JSON.parse(node.getPluginData('nodeInfo'));

  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'font', status: false },
  });
  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'text', status: false },
  });
  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'style', status: false },
  });
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
  await Promise.all(rangeFontNames.map((name) => figma.loadFontAsync(name)));
  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'font', status: true },
  });

  newNodeInfo.nowLangId = payload;
  const styles = getStyle(node.id);
  if (!newNodeInfo.nodeContents[`${payload}`]) {
    newNodeInfo.nodeContents[`${payload}`] = {
      characters: node.characters,
      style: styles.style,
      characterStyleOverrides: styles.characterStyleOverrides,
      styleOverrideTable: styles.styleOverrideTable,
    };
  }
  node.characters = newNodeInfo.nodeContents[`${payload}`].characters;
  node.setPluginData('nodeInfo', JSON.stringify(newNodeInfo));

  const nodeContents = newNodeInfo.nodeContents;
  const contents = {
    characters: node.characters || null,
    nowNodeLang: payload,
    nodeContents: nodeContents,
  };
  styleStatus += 1;
  setStyle(
    node.id,
    newNodeInfo.nodeContents[payload].style,
    newNodeInfo.nodeContents[payload].characterStyleOverrides,
    newNodeInfo.nodeContents[payload].styleOverrideTable,
  );

  postMessage({
    type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
    payload: { id: 'text', status: true },
  });

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
  fills?: ReadonlyArray<Paint>;
  fillStyleId?: string;
  textStyleId?: string;
}

interface StyleOverridesType {
  [key: string]: any;
}

async function setStyle(
  id: string,
  style: StyleType,
  characterStyleOverrides: number[],
  styleOverrideTable: StyleOverridesType,
) {
  const node = <TextNode>figma.getNodeById(id);
  if (style.fontSize) node.fontSize = style.fontSize;
  if (style.fontName) {
    await figma.loadFontAsync(style.fontName);
    node.fontName = style.fontName;
  }
  if (style.textCase) node.textCase = style.textCase;
  if (style.textDecoration) node.textDecoration = style.textDecoration;
  if (style.letterSpacing) node.letterSpacing = style.letterSpacing;
  if (style.lineHeight) node.lineHeight = style.lineHeight;
  if (style.fills) node.fills = style.fills;
  if (!styleOverrideTable || !characterStyleOverrides) {
    styleStatus--;
    if (styleStatus === 0) {
      postMessage({
        type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
        payload: { id: 'style', status: true },
      });
    }
    return;
  }
  for (let i = 0; i < node.characters.length; i++) {
    if (!styleOverrideTable[characterStyleOverrides[i]]) continue;
    if (styleOverrideTable[characterStyleOverrides[i]].fontSize)
      node.setRangeFontSize(i, i + 1, styleOverrideTable[characterStyleOverrides[i]].fontSize);
    if (styleOverrideTable[characterStyleOverrides[i]].fontName) {
      await figma.loadFontAsync(styleOverrideTable[characterStyleOverrides[i]].fontName);
      node.setRangeFontName(i, i + 1, styleOverrideTable[characterStyleOverrides[i]].fontName);
    }
    if (styleOverrideTable[characterStyleOverrides[i]].textCase)
      node.setRangeTextCase(i, i + 1, styleOverrideTable[characterStyleOverrides[i]].textCase);
    if (styleOverrideTable[characterStyleOverrides[i]].textDecoration)
      node.setRangeTextDecoration(
        i,
        i + 1,
        styleOverrideTable[characterStyleOverrides[i]].textDecoration,
      );
    if (styleOverrideTable[characterStyleOverrides[i]].letterSpacing)
      node.setRangeLetterSpacing(
        i,
        i + 1,
        styleOverrideTable[characterStyleOverrides[i]].letterSpacing,
      );
    if (styleOverrideTable[characterStyleOverrides[i]].lineHeight)
      node.setRangeLineHeight(i, i + 1, styleOverrideTable[characterStyleOverrides[i]].lineHeight);
    if (styleOverrideTable[characterStyleOverrides[i]].fills)
      node.setRangeFills(i, i + 1, styleOverrideTable[characterStyleOverrides[i]].fills);
  }
  styleStatus--;
  if (styleStatus === 0) {
    postMessage({
      type: WorkerActionTypes.SET_FONT_LOAD_STATUS,
      payload: { id: 'style', status: true },
    });
  }
}

function getDefaultStyle(id: string) {
  const node = <TextNode>figma.getNodeById(id);
  return {
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
    fills: node.fills !== figma.mixed ? node.fills : ((null as unknown) as ReadonlyArray<Paint>),
    fillStyleId:
      node.fillStyleId !== figma.mixed ? node.fillStyleId : ((null as unknown) as string),
    textStyleId:
      node.textStyleId !== figma.mixed ? node.textStyleId : ((null as unknown) as string),
  } as StyleType;
}

function getStyle(id: string) {
  const node = <TextNode>figma.getNodeById(id);
  const defaultStyle = getDefaultStyle(id);
  const characterStyleOverrides = [];
  const styleOverrideTable = {} as StyleOverridesType;
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
    if (!defaultStyle.fills) style.fills = <Paint[]>node.getRangeFills(i, i + 1);
    if (!defaultStyle.fillStyleId) style.fillStyleId = <string>node.getRangeFillStyleId(i, i + 1);
    if (!defaultStyle.textStyleId) style.textStyleId = <string>node.getRangeTextStyleId(i, i + 1);
    const tableIndex = Object.keys(styleOverrideTable).findIndex((key) => {
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
  const textNodeList = JSON.parse(figma.currentPage.getPluginData('textNodeList') || "[]");
  const langList = JSON.parse(figma.root.getPluginData('langList') || "[]");
  const globalLang = figma.root.getPluginData('globalLang');
  const exportMap = {
    languages: langList,
    textNodeList,
    i18n: textNodeList.reduce((prevObject: any, textNodeId: string) => {
      const node = <TextNode>figma.getNodeById(textNodeId);
      const styles = getStyle(textNodeId);
      if (!node.getPluginData('nodeInfo')) {
        node.setPluginData(
          'nodeInfo',
          JSON.stringify({
            nodeContents: langList.reduce((acc: any, lang: LangType) => {
              acc[lang.id.toString()] = {
                characters: node.characters,
                style: styles.style,
                characterStyleOverrides: styles.characterStyleOverrides,
                styleOverrideTable: styles.styleOverrideTable,
              };
              return acc;
            }, {}),
            nowLangId: globalLang,
          }),
        );
      }
      const { nodeContents } = JSON.parse(node.getPluginData('nodeInfo'));
      return {
        ...prevObject,
        [textNodeId]: nodeContents,
      };
    }, {}),
  };
  postMessage({ type: WorkerActionTypes.EXPORT, payload: JSON.stringify(exportMap) });
}

async function importFile(payload: string) {
  const { content, currentLang } = JSON.parse(payload);
  const { textNodeList, i18n, languages, globalLang } = JSON.parse(content);
  figma.currentPage.setPluginData('textNodeList', JSON.stringify(textNodeList));
  figma.root.setPluginData('globalLang', `${languages[0].id}`);
  figma.root.setPluginData('langList', JSON.stringify(languages));
  figma.root.setPluginData('lang-id-index', `${languages.length}`);
  Init();
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
