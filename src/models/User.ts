import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
    discord_id: string;
    username: string;
    guilds: Array<string>;
    password?: string;
    token?: string;
    createdAt: Date;
}

const schema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    discord_id: {
        type: String,
        required: true,
    },
    guilds: {
        type: Array,
        required: true,
        default: []
    },
    password: {
        type: String,
        required: false
    },
    token: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        required: true,
    }
});

export default model('User', schema);