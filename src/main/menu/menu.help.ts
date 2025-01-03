import { MenuItemConstructorOptions } from "electron";

export function menu_help(): MenuItemConstructorOptions {
    const items: MenuItemConstructorOptions = {
        label: "Help",
        submenu: [
            {
                role: "toggleDevTools"
            },
            {
                type: "separator"
            },
            {
                label: "About",
                click: () => {
                }
            }
        ]
    };
    return items;
}
