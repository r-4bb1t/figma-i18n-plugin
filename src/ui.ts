import { UIActionTypes, UIAction, WorkerActionTypes, WorkerAction } from './types';

import './ui.css';

let global_lang = 'default';
let langList = [{ id: 0, name: 'default' }];

// Sends a message to the plugin worker
function postMessage({ type, payload }: UIAction): void {
  parent.postMessage({ pluginMessage: { type, payload } }, '*');
}

// Listen to messages received from the plugin worker (src/plugin/plugin.ts)
function listenToPluginMessages(): void {
  window.onmessage = function (event: MessageEvent): void {
    const pluginMessage = event.data.pluginMessage as WorkerAction;
    const { type, payload } = pluginMessage;

    switch (type) {
      case WorkerActionTypes.INIT:
        init(payload);
        break;
      case WorkerActionTypes.CREATE_RECTANGLE_NOTIFY:
        payload && alert(payload);
        break;
      case WorkerActionTypes.SELECTED_NODE:
        ChangeNodeId(payload.id);
        if (payload.type === 'TEXT') ChangeNodeContents(payload.contents);
        break;
      case WorkerActionTypes.ADD_LANG:
        AddLang(payload);
        break;
    }
  };
}

// Close the plugin if pressing Esc key when the input is not focused
function closeWithEscapeKey(): void {
  const tagExceptions = ['input', 'textarea'];

  document.addEventListener('keydown', function (event: KeyboardEvent) {
    try {
      const target = event.target as HTMLElement;
      if (
        event.code.toString().toLowerCase() === 'escape' &&
        !tagExceptions.includes(target.tagName.toLowerCase())
      ) {
        postMessage({ type: UIActionTypes.CLOSE });
      }
    } catch (error) {
      console.error(error);
    }
  });
}

function buttonListeners(): void {
  document.addEventListener('click', function (event: MouseEvent) {
    const target = event.target as HTMLElement;
    switch (target.id) {
      case 'notificationBtn':
        postMessage({ type: UIActionTypes.NOTIFY, payload: 'Hello!' });
        break;
      case 'applyGlobalLangBtn':
        postMessage({ type: UIActionTypes.APPLY_GLOBAL_LANG, payload: global_lang });
        break;
      case 'addLangBtn':
        postMessage({ type: UIActionTypes.ADD_LANG });
        break;
      case 'deleteLangBtn':
        DeleteLang();
        break;
      case 'editLangBtn':
        EditLang();
        break;
      case 'editDoneLangBtn':
        EditDoneLang();
        break;
      case 'closeBtn':
        postMessage({ type: UIActionTypes.CLOSE });
        break;
      case 'setPluginData':
        postMessage({ type: UIActionTypes.SET_PLUGIN_DATA, payload: new Date().toString() });
        break;
      case 'getPluginData':
        postMessage({ type: UIActionTypes.GET_PLUGIN_DATA, payload: new Date().toString() });
        break;
    }
  });
}

function init(payload: any) {
  const globalSelect = document.getElementById('globalSelect') as HTMLSelectElement;
  langList = JSON.parse(payload.langList);
  for (let i = 0; i < langList.length; i++) {
    const newOption = document.createElement('option');
    newOption.innerText = langList[i].name;
    globalSelect.appendChild(newOption);
    const newTab = document.createElement('div');
    newTab.className = 'previewLangBtn';
    newTab.innerText = newOption.innerText;
    document.getElementById('previewTab')!.appendChild(newTab);
  }
}

function AddLang(id: number) {
  const globalSelect = document.getElementById('globalSelect') as HTMLSelectElement;
  const newOption = document.createElement('option');
  newOption.innerText = `lang(${id})`;
  globalSelect.appendChild(newOption);
  globalSelect.value = newOption.innerText;
  const newTab = document.createElement('div');
  newTab.className = 'previewLangBtn';
  newTab.innerText = newOption.innerText;
  document.getElementById('previewTab')!.appendChild(newTab);
  langList.push({ id: id, name: `lang(${id})` });
}

function DeleteLang() {
  const globalSelect = document.getElementById('globalSelect') as HTMLSelectElement;
  if (globalSelect.length === 1) {
    postMessage({
      type: UIActionTypes.NOTIFY,
      payload: 'At least one language must remain.',
    });
  } else if (
    confirm(
      'The contents of the selected language will disappear from all nodes. Would you like to go on?',
    )
  ) {
    postMessage({
      type: UIActionTypes.DELETE_LANG,
      payload: langList[globalSelect.selectedIndex].id,
    });
    const target = document.getElementById('previewTab')!.children[globalSelect.selectedIndex];
    if (target) document.getElementById('previewTab')!.removeChild(target);
    globalSelect.remove(globalSelect.selectedIndex);
    langList = langList.splice(globalSelect.selectedIndex, 1);
  }
}

function EditLang() {
  const globalSelect = document.getElementById('globalSelect') as HTMLSelectElement;
  const editLangDiv = document.getElementById('editLangDiv');
  globalSelect.disabled = true;
  editLangDiv!.style.display = 'flex';
  (<HTMLButtonElement>document.getElementById('applyGlobalLangBtn'))!.disabled = true;
  (<HTMLButtonElement>document.getElementById('addLangBtn'))!.disabled = true;
  (<HTMLButtonElement>document.getElementById('deleteLangBtn'))!.disabled = true;
  (<HTMLButtonElement>document.getElementById('editLangBtn'))!.style.display = 'none';
  (<HTMLInputElement>document.getElementById('editLangInput')).placeholder =
    globalSelect.options[globalSelect.selectedIndex].innerText;
  (<HTMLInputElement>document.getElementById('editLangInput')).value =
    globalSelect.options[globalSelect.selectedIndex].innerText;
}

function EditDoneLang() {
  const globalSelect = document.getElementById('globalSelect') as HTMLSelectElement;
  (<HTMLButtonElement>document.getElementById('editLangBtn'))!.style.display = 'block';
  document.getElementById('editLangDiv')!.style.display = 'none';
  globalSelect.disabled = false;
  (<HTMLButtonElement>document.getElementById('applyGlobalLangBtn'))!.disabled = false;
  (<HTMLButtonElement>document.getElementById('addLangBtn'))!.disabled = false;
  (<HTMLButtonElement>document.getElementById('deleteLangBtn'))!.disabled = false;
  const newName = (<HTMLInputElement>document.getElementById('editLangInput')).value;
  if (newName !== '') {
    postMessage({
      type: UIActionTypes.EDIT_LANG,
      payload: { id: langList[globalSelect.selectedIndex].id, name: newName },
    });
    langList[globalSelect.selectedIndex].name = newName;
    (<HTMLOptionElement>globalSelect.options[globalSelect.selectedIndex]).innerText = newName;
    (<HTMLDivElement>(
      document.getElementById('previewTab')!.children[globalSelect.selectedIndex]
    )).innerText = newName;
  }
}

function ChangeNodeId(id: string) {
  const selectedNodeId = document.getElementById('selectedNodeID') as HTMLInputElement;
  if (selectedNodeId) selectedNodeId.value = id;
}

function ChangeNodeContents(contents: any) {
  (<HTMLInputElement>document.getElementById('innertext')).value = contents.characters;
}

function main() {
  postMessage({ type: UIActionTypes.INIT });
  document.getElementById('globalSelect')?.addEventListener('change', (e: any) => {
    global_lang = e?.target?.value || null;
    postMessage({ type: UIActionTypes.SET_GLOBAL_LANG, payload: e?.target?.value || null });
  });
}

// Initialize all the things
listenToPluginMessages();
closeWithEscapeKey();
buttonListeners();
main();
