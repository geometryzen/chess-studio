import { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { CHANNEL_ACTION_TREE_DELETE_CHILDREN, CHANNEL_ACTION_TREE_DELETE_NODE, CHANNEL_ACTION_TREE_DELETE_OTHER_LINES, CHANNEL_ACTION_TREE_DELETE_SIBLINGS, CHANNEL_ACTION_TREE_END, CHANNEL_ACTION_TREE_NEXT, CHANNEL_ACTION_TREE_NEXT_SIBLING, CHANNEL_ACTION_TREE_PREVIOUS, CHANNEL_ACTION_TREE_PREVIOUS_SIBLING, CHANNEL_ACTION_TREE_PROMOTE_LINE_BY_ONE_LEVEL, CHANNEL_ACTION_TREE_PROMOTE_LINE_TO_MAIN_LINE, CHANNEL_ACTION_TREE_RETURN_TO_MAIN_LINE, CHANNEL_ACTION_TREE_ROOT } from "../../shared/ipc-constants";

export function menu_tree(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Tree",
        submenu: [
            menu_item_tree_root(win),
            menu_item_tree_end(win),
            menu_item_tree_backward(win),
            menu_item_tree_forward(win),
            menu_item_tree_previous_sibling(win),
            menu_item_tree_next_sibling(win),
            {
                type: "separator"
            },
            menu_item_tree_return_to_main_line(win),
            menu_item_tree_promote_line_to_main_line(win),
            menu_item_tree_promote_line_by_one_level(win),
            {
                type: "separator"
            },
            menu_item_tree_delete_node(win),
            menu_item_tree_delete_children(win),
            menu_item_tree_delete_siblings(win),
            {
                type: "separator"
            },
            menu_item_tree_delete_other_lines(win),
        ]
    };
    return items;
}

function menu_item_tree_root(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Root",
        accelerator: "Home",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_ROOT);
        }
    };
    return items;
}

function menu_item_tree_end(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "End",
        accelerator: "End",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_END);
        }
    };
    return items;
}

function menu_item_tree_backward(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Backward",
        accelerator: "Left",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_PREVIOUS);
        }
    };
    return items;
}

function menu_item_tree_forward(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Forward",
        accelerator: "Right",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_NEXT);
        }
    };
    return items;
}

function menu_item_tree_previous_sibling(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Previous sibling",
        accelerator: "Up",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_PREVIOUS_SIBLING);
        }
    };
    return items;
}

function menu_item_tree_next_sibling(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Next sibling",
        accelerator: "Down",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_NEXT_SIBLING);
        }
    };
    return items;
}

function menu_item_tree_return_to_main_line(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Return to main line",
        accelerator: "CommandOrControl+R",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_RETURN_TO_MAIN_LINE);
        }
    };
    return items;
}

function menu_item_tree_promote_line_to_main_line(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Promote line to main line",
        accelerator: "CommandOrControl+L",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_PROMOTE_LINE_TO_MAIN_LINE);
        }
    };
    return items;
}

function menu_item_tree_promote_line_by_one_level(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Promote line by 1 level",
        accelerator: "CommandOrControl+Up",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_PROMOTE_LINE_BY_ONE_LEVEL);
        }
    };
    return items;
}

function menu_item_tree_delete_node(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Delete node",
        accelerator: "CommandOrControl+Backspace",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_DELETE_NODE);
        }
    };
    return items;
}

function menu_item_tree_delete_children(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Delete children",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_DELETE_CHILDREN);
        }
    };
    return items;
}

function menu_item_tree_delete_siblings(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Delete siblings",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_DELETE_SIBLINGS);
        }
    };
    return items;
}

function menu_item_tree_delete_other_lines(win: BrowserWindow): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Delete other lines",
        click: () => {
            win.webContents.send(CHANNEL_ACTION_TREE_DELETE_OTHER_LINES);
        }
    };
    return items;
}
