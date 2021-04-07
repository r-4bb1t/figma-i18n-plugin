export enum UIActionTypes {
  CLOSE = 'CLOSE',
  NOTIFY = 'NOTIFY',
  CREATE_RECTANGLE = 'CREATE_RECTANGLE',
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
  CREATE_RECTANGLE_NOTIFY = 'CREATE_RECTANGLE_NOTIFY',
  SELECTED_NODE = 'SELECTED_NODE',
}

export interface WorkerAction {
  type: WorkerActionTypes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}
