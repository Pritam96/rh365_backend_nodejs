import connectDB from "./config/db.js";
import errorHandler from "./middlewares/error.js";
import app from "./app.js";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";

const PORT = process.env.PORT || 5000;

const dbName = "RH_Data";

connectDB(dbName);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use(errorHandler);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
