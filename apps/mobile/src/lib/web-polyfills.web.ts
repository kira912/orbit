import { Alert, type AlertButton } from "react-native";

/**
 * react-native-web ships Alert.alert as a no-op, which would silently drop
 * every confirmation. Map it onto the browser dialogs: the app only ever
 * asks "cancel or one action", which is exactly window.confirm.
 */
Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const text = message ? `${title}\n\n${message}` : title;
  const cancel = buttons?.find((b) => b.style === "cancel");
  const action = buttons?.filter((b) => b !== cancel).at(-1);
  if (!action) {
    window.alert(text);
    cancel?.onPress?.();
    return;
  }
  if (window.confirm(text)) action.onPress?.();
  else cancel?.onPress?.();
};
