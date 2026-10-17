import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    // unique index = duplicates are rejected by the database itself
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    // SHA-256 hash of the current login token (see utils/token.js)
    token: { type: String, index: true },
    tokenExpires: { type: Date },
    contacts: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export { User };
