import { Types } from "mongoose";
import { AlertModel, IAlert } from "../models/Alert.model.js";
import { emitAlertToUser } from "../server.js";

export const alertService = {
  async createAlert(input: {
    userId: string;
    type: IAlert["type"];
    message: string;
    tenderId?: string;
    material?: string;
  }): Promise<IAlert> {
    const alert = await AlertModel.create({
      userId: new Types.ObjectId(input.userId),
      type: input.type,
      message: input.message,
      tenderId: input.tenderId ? new Types.ObjectId(input.tenderId) : null,
      material: input.material ?? null,
      isRead: false
    });

    emitAlertToUser(input.userId, {
      _id: alert._id.toString(),
      type: alert.type,
      message: alert.message,
      tenderId: alert.tenderId ? alert.tenderId.toString() : null,
      material: alert.material,
      isRead: alert.isRead,
      createdAt: alert.createdAt
    });

    return alert;
  }
};
