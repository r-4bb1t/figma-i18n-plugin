export enum UIActionTypes {
  INIT = 'INIT',
  CLOSE = 'CLOSE',
  NOTIFY = 'NOTIFY',
  SET_GLOBAL_LANG = 'SET_GLOBAL_LANG',
  APPLY_GLOBAL_LANG = 'APPLY_GLOBAL_LANG',
  ADD_LANG = 'ADD_LANG',
  DELETE_LANG = 'DELETE_LANG',
  EDIT_LANG = 'EDIT_LANG',
  SET_PLUGIN_DATA = 'SET_PLUGIN_DATA',
  GET_PLUGIN_DATA = 'GET_PLUGIN_DATA',
  ADD_SELECTED_NODE_DETECTOR = 'ADD_SELECTED_NODE_DETECTOR',
}

export interface UIAction {
  type: UIActionTypes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}

export enum WorkerActionTypes {
  INIT = 'INIT',
  CREATE_RECTANGLE_NOTIFY = 'CREATE_RECTANGLE_NOTIFY',
  SELECTED_NODE = 'SELECTED_NODE',
  ADD_LANG = 'ADD_LANG',
}

export interface WorkerAction {
  type: WorkerActionTypes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}
