import { useDialog } from "naive-ui";

export function useConfirmDelete() {
  const dialog = useDialog();

  function confirmDelete(options: {
    title?: string;
    content: string;
    onOk: () => void;
  }) {
    dialog.warning({
      title: options.title ?? "确认删除",
      content: options.content,
      positiveText: "确认删除",
      negativeText: "取消",
      positiveButtonProps: {
        type: "error"
      },
      onPositiveClick: () => {
        options.onOk();
      }
    });
  }

  function confirmAction(options: {
    title: string;
    content: string;
    positiveText?: string;
    onOk: () => void;
  }) {
    dialog.warning({
      title: options.title,
      content: options.content,
      positiveText: options.positiveText ?? "确认",
      negativeText: "取消",
      onPositiveClick: () => {
        options.onOk();
      }
    });
  }

  return { confirmDelete, confirmAction };
}
