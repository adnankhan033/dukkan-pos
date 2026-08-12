import { useState } from "react";
import { CheckCircle2, Download, RotateCcw, Trash2 } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import BackupCloudPanel from "../components/settings/BackupCloudPanel";
import "./CloudBackup.css";
import "./Settings.css";

export default function CloudBackup() {
  const [busy, setBusy] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(null);

  return (
    <div className="cloud-backup-page">
      <PageHeader
        title="Cloud Backup"
        subtitle="Send full store backups to Gmail and schedule daily local + email backups."
      />

      <BackupCloudPanel
        busy={busy}
        onBusyChange={setBusy}
        onNotify={setFeedbackModal}
      />

      <Modal
        isOpen={Boolean(feedbackModal)}
        onClose={() => setFeedbackModal(null)}
        title={feedbackModal?.title || ""}
        footer={<Button onClick={() => setFeedbackModal(null)}>OK</Button>}
      >
        {feedbackModal && (
          <div className="settings-feedback-modal">
            <div className={`settings-feedback-icon ${feedbackModal.icon === "error" ? "error" : "success"}`}>
              {feedbackModal.icon === "error" ? (
                <Trash2 size={28} />
              ) : feedbackModal.icon === "restore" ? (
                <RotateCcw size={28} />
              ) : feedbackModal.icon === "download" ? (
                <Download size={28} />
              ) : (
                <CheckCircle2 size={28} />
              )}
            </div>
            <div className="settings-feedback-body">{feedbackModal.body}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
