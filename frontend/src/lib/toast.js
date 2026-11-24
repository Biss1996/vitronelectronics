import Swal from "sweetalert2";

const RED = "#E10600";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

export const toast = {
  success: (title) => Toast.fire({ icon: "success", title }),
  error: (title) => Toast.fire({ icon: "error", title, timer: 4000 }),
  info: (title) => Toast.fire({ icon: "info", title, timer: 4000 }),
};

/** Promise<boolean> — styled confirm dialog. */
export async function confirm({ title, text, confirmText = "Yes, continue", danger = false }) {
  const r = await Swal.fire({
    title,
    text,
    icon: danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    confirmButtonColor: danger ? RED : "#0B0B0B",
    cancelButtonColor: "#9ca3af",
    reverseButtons: true,
  });
  return r.isConfirmed;
}

export function alertError(title, text) {
  return Swal.fire({ icon: "error", title, text, confirmButtonColor: RED });
}
