import mongoose, { Schema } from "mongoose";

// A meeting that was created through the API. The code is what people share.
const roomSchema = new Schema({
  code: { type: String, required: true, unique: true },
  host: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
});

const Room = mongoose.model("Room", roomSchema);

export { Room };
