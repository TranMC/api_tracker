import { getSettings, updateSettings } from "./settings.service.js";

export function getSettingsHandler(req, res, next) {
  try {
    const settings = getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

export function updateSettingsHandler(req, res, next) {
  try {
    const { criteriaEnabled, updatedBy } = req.body;
    const updates = {};
    if (criteriaEnabled !== undefined) {
      updates.criteriaEnabled = Boolean(criteriaEnabled);
    }
    if (updatedBy !== undefined) {
      updates.updatedBy = String(updatedBy);
    }

    const updated = updateSettings(updates);
    res.json({ success: true, settings: updated });
  } catch (err) {
    next(err);
  }
}
