import { useState, useEffect, useRef, useCallback, memo } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import axios from "axios";

function Dashboard({ entries, calorieGoal, setCalorieGoal, proteinPercent, setProteinPercent, fatPercent, setFatPercent, carbPercent, setCarbPercent, notificationPermission, notifications, setNotifications }) {
  const navigate = useNavigate();
  console.log("Dashboard: Initializing component");
  const proteinGrams = ((proteinPercent / 100) * calorieGoal) / 4;
  const fatGrams = ((fatPercent / 100) * calorieGoal) / 9;
  const carbGrams = ((carbPercent / 100) * calorieGoal) / 4;

  const today = new Date().toLocaleDateString("en-CA");
  const todayEntries = entries.filter((entry) => entry.date === today);
  const currentProtein = todayEntries.reduce((sum, entry) => sum + (entry.macros?.protein || 0), 0);
  const currentFat = todayEntries.reduce((sum, entry) => sum + (entry.macros?.fat || 0), 0);
  const currentCarbs = todayEntries.reduce((sum, entry) => sum + (entry.macros?.carbs || 0), 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA");
  const yesterdayEntries = entries.filter((entry) => entry.date === yesterdayStr);
  const yesterdayProtein = yesterdayEntries.reduce((sum, entry) => sum + (entry.macros?.protein || 0), 0);
  const yesterdayFat = yesterdayEntries.reduce((sum, entry) => sum + (entry.macros?.fat || 0), 0);
  const yesterdayCarbs = yesterdayEntries.reduce((sum, entry) => sum + (entry.macros?.carbs || 0), 0);

  const [report, setReport] = useState(() => {
    const saved = localStorage.getItem("dailyReport");
    const savedDate = localStorage.getItem("dailyReportDate");
    if (saved && savedDate === today) {
      return saved;
    }
    return "";
  });
  const [learningPeriodComplete, setLearningPeriodComplete] = useState(() => {
    const saved = localStorage.getItem("learningPeriodComplete");
    return saved ? JSON.parse(saved) : false;
  });
  const [firstEntryDate, setFirstEntryDate] = useState(() => {
    const saved = localStorage.getItem("firstEntryDate");
    console.log("Dashboard: Initializing firstEntryDate from LocalStorage:", saved);
    return saved || null;
  });
  const [dailyQuote, setDailyQuote] = useState(() => {
    const saved = localStorage.getItem("dailyQuote");
    const savedDate = localStorage.getItem("dailyQuoteDate");
    if (saved && savedDate === today) {
      return saved;
    }
    return null;
  });
  const [quoteLoading, setQuoteLoading] = useState(true);
  const hasCompletedLearningRef = useRef(learningPeriodComplete);
  const hasGeneratedQuoteRef = useRef(false);
  const hasGeneratedReportRef = useRef(false);

  const uniqueDays = [...new Set(entries.map((entry) => entry.date))];
  const hasEnoughData = uniqueDays.length >= 5;
  const isFirstDay = entries.length === 0 || (firstEntryDate && today === firstEntryDate);

  useEffect(() => {
    console.log("Dashboard: Running useEffect for firstEntryDate");
    if (entries.length > 0 && !firstEntryDate) {
      const earliestEntry = entries.reduce((earliest, entry) => {
        const entryDate = new Date(entry.date);
        return !earliest || entryDate < new Date(earliest.date) ? entry : earliest;
      }, null);
      const firstDate = earliestEntry.date;
      setFirstEntryDate(firstDate);
      localStorage.setItem("firstEntryDate", firstDate);
      console.log("Dashboard: Set firstEntryDate to", firstDate);
    }
  }, [entries, firstEntryDate]);

  useEffect(() => {
    const savedDate = localStorage.getItem("dailyQuoteDate");
    if (savedDate === today && hasGeneratedQuoteRef.current) {
      setQuoteLoading(false);
      return;
    }

    const generateQuote = async () => {
      const prompt = `Generate a short, motivational quote (1-2 sentences) for a health and fitness app user to encourage them in their macro tracking journey. Keep it positive, concise, and inspiring, and do not include quotation marks around the quote.`;
      try {
        console.log("Sending request to /claude-snack with URL:", `${import.meta.env.VITE_BACKEND_URL}/claude-snack`, "and body:", { prompt });
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/claude-snack`,
          { prompt },
          { headers: { "Content-Type": "application/json" } }
        );
        const quote = response.data.text;
        setDailyQuote(quote);
        localStorage.setItem("dailyQuote", quote);
        localStorage.setItem("dailyQuoteDate", today);
        hasGeneratedQuoteRef.current = true;

        // Add the quote as a notification
        const nowTimestamp = new Date().getTime();
        const newNotification = {
          id: nowTimestamp,
          title: "Daily Motivation",
          body: quote,
          timestamp: nowTimestamp,
          read: false,
        };
        setNotifications((prev) => [...prev, newNotification]);
      } catch (error) {
        console.error("Error generating motivational quote:", error);
        const fallbackQuote = "Keep pushing forward—you’ve got this!";
        setDailyQuote(fallbackQuote);
        localStorage.setItem("dailyQuote", fallbackQuote);
        localStorage.setItem("dailyQuoteDate", today);
        hasGeneratedQuoteRef.current = true;

        const nowTimestamp = new Date().getTime();
        const newNotification = {
          id: nowTimestamp,
          title: "Daily Motivation",
          body: fallbackQuote,
          timestamp: nowTimestamp,
          read: false,
        };
        setNotifications((prev) => [...prev, newNotification]);
      } finally {
        setQuoteLoading(false);
      }
    };

    setQuoteLoading(true);
    generateQuote();
  }, [today, setNotifications]);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    if (learningPeriodComplete || uniqueDays.length !== 0) return;

    try {
      new Notification("Welcome to Daily Macro Journal!", {
        body: "We’re getting to know your eating habits—when you eat, what you enjoy, and how you balance your macros. Log your meals for 5 days, and we’ll start providing personalized insights to help you reach your goals! 🌟",
      });
      console.log("Initial learning period notification sent.");

      const nowTimestamp = new Date().getTime();
      const newNotification = {
        id: nowTimestamp,
        title: "Welcome to Daily Macro Journal!",
        body: "We’re getting to know your eating habits—when you eat, what you enjoy, and how you balance your macros. Log your meals for 5 days, and we’ll start providing personalized insights to help you reach your goals! 🌟",
        timestamp: nowTimestamp,
        read: false,
      };
      setNotifications((prev) => [...prev, newNotification]);
    } catch (error) {
      console.error("Initial Notification Error:", error);
    }
  }, [notificationPermission, learningPeriodComplete, uniqueDays.length, setNotifications]);

  useEffect(() => {
    if (notificationPermission !== "granted") return;
    if (learningPeriodComplete || !hasEnoughData || hasCompletedLearningRef.current) return;

    console.log("Learning period complete! Sending completion notification...");
    try {
      new Notification("Learning Period Complete!", {
        body: "We’ve learned your eating patterns! From now on, expect tailored insights to keep you on track—let’s make every meal count! 🎉",
      });
      console.log("Completion notification sent successfully!");

      const nowTimestamp = new Date().getTime();
      const newNotification = {
        id: nowTimestamp,
        title: "Learning Period Complete!",
        body: "We’ve learned your eating patterns! From now on, expect tailored insights to keep you on track—let’s make every meal count! 🎉",
        timestamp: nowTimestamp,
        read: false,
      };
      setNotifications((prev) => [...prev, newNotification]);

      setLearningPeriodComplete(true);
      localStorage.setItem("learningPeriodComplete", JSON.stringify(true));
      hasCompletedLearningRef.current = true;
    } catch (error) {
      console.error("Completion Notification Error:", error);
    }
  }, [notificationPermission, hasEnoughData, learningPeriodComplete, setNotifications]);

  useEffect(() => {
    if (entries.length === 0) {
      setReport("Log your first meal to start tracking your macros!");
      return;
    }

    if (isFirstDay) {
      setReport("Complete a full day of meals to generate your first nutrition wrap up!");
      return;
    }

    const savedDate = localStorage.getItem("dailyReportDate");
    const savedReport = localStorage.getItem("dailyReport");
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && savedDate === today && savedReport && hasGeneratedReportRef.current) {
      setReport(savedReport);
      return;
    }

    const generateReport = async () => {
      const prompt = `📊 Generate a positive daily macro report for yesterday. Keep it encouraging, with no shaming. Include:
      - A summary of the user's goals and actual intake.
      - Intuitive, specific suggestions to help the user meet their goals, based on yesterday's entries. Suggestions can include:
        * Adding a food (e.g., "Add 6 oz of chicken for 30g protein").
        * Swapping a food (e.g., "Swap your apple for Greek yogurt to add 18g protein").
        * Reducing a food (e.g., "Try having a bit less potato to balance your carbs").
        * Adjusting quantities (e.g., "Reduce your rice from 300g to 250g and increase your ground beef from 8 oz to 10 oz").
        * Or no suggestion if the user is on track (just celebrate their success).
      Be creative and precise, focusing on the most impactful change. If no entries exist, provide a fresh-start message with a generic suggestion.

      Goals:
      - Calories: ${calorieGoal} kcal
      - Protein: ${proteinPercent}% (${proteinGrams}g)
      - Fat: ${fatPercent}% (${fatGrams}g)
      - Carbs: ${carbPercent}% (${carbGrams}g)

      Yesterday's Intake:
      - Protein: ${yesterdayProtein}g
      - Fat: ${yesterdayFat}g
      - Carbs: ${yesterdayCarbs}g

      Yesterday's Entries (with individual macros): ${yesterdayEntries.length > 0 ? JSON.stringify(yesterdayEntries) : "No entries logged."}`;
      
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/claude-report`,
          { prompt },
          { headers: { "Content-Type": "application/json" } }
        );
        const newReport = response.data.text;
        setReport(newReport);
        localStorage.setItem("dailyReport", newReport);
        localStorage.setItem("dailyReportDate", today);
        hasGeneratedReportRef.current = true;
      } catch (error) {
        console.error("API Error:", error);
        const fallbackReport = "Oops, couldn’t generate your report—try again later!";
        setReport(fallbackReport);
        localStorage.setItem("dailyReport", fallbackReport);
        localStorage.setItem("dailyReportDate", today);
        hasGeneratedReportRef.current = true;
      }
    };

    generateReport();
  }, [calorieGoal, proteinPercent, fatPercent, carbPercent, yesterdayProtein, yesterdayFat, yesterdayCarbs, isFirstDay]);

  console.log("Dashboard: Rendering component");
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Daily Macro Journal</h1>
      <nav className="mb-6 flex space-x-4">
        <Link to="/journal" className="text-blue-500 hover:underline">
          Go to Food Journal
        </Link>
        <Link to="/notifications" className="text-blue-500 hover:underline">
          Notifications ({notifications.filter(n => !n.read).length})
        </Link>
      </nav>

      <div className="mb-6 bg-blue-50 p-4 rounded shadow text-center">
        <h2 className="text-xl font-semibold mb-2">Daily Motivation</h2>
        {quoteLoading ? (
          <p className="italic text-gray-700">Loading your daily motivation...</p>
        ) : (
          <p className="italic text-gray-700">{dailyQuote}</p>
        )}
      </div>

      {!learningPeriodComplete && (
        <div className="mb-6 bg-yellow-100 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Learning Your Habits</h2>
          <p>We’re getting to know your eating habits! Log your meals for 5 days to unlock personalized insights. Days logged: {uniqueDays.length}/5</p>
        </div>
      )}

      <div className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Daily Report</h2>
        <p>{report}</p>
      </div>

      <div className="mb-4">
        <label className="block text-lg font-medium mb-2">Calorie Goal:</label>
        <input
          type="number"
          value={calorieGoal}
          onChange={(e) => setCalorieGoal(Number(e.target.value))}
          className="border p-2 rounded w-full max-w-xs"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-lg font-medium mb-2">Protein (%):</label>
          <input
            type="number"
            value={proteinPercent}
            onChange={(e) => setProteinPercent(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
        </div>
        <div>
          <label className="block text-lg font-medium mb-2">Fat (%):</label>
          <input
            type="number"
            value={fatPercent}
            onChange={(e) => setFatPercent(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
        </div>
        <div>
          <label className="block text-lg font-medium mb-2">Carbs (%):</label>
          <input
            type="number"
            value={carbPercent}
            onChange={(e) => setCarbPercent(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-lg font-medium">
            Protein: {currentProtein.toFixed(1)}/{proteinGrams.toFixed(0)}g (
            {((currentProtein / proteinGrams) * 100).toFixed(0)}%)
          </p>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-500 h-4 rounded-full"
              style={{ width: `${Math.min((currentProtein / proteinGrams) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
        <div>
          <p className="text-lg font-medium">
            Fat: {currentFat.toFixed(1)}/{fatGrams.toFixed(0)}g (
            {((currentFat / fatGrams) * 100).toFixed(0)}%)
          </p>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full"
              style={{ width: `${Math.min((currentFat / fatGrams) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
        <div>
          <p className="text-lg font-medium">
            Carbs: {currentCarbs.toFixed(1)}/{carbGrams.toFixed(0)}g (
            {((currentCarbs / carbGrams) * 100).toFixed(0)}%)
          </p>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-orange-500 h-4 rounded-full"
              style={{ width: `${Math.min((currentCarbs / carbGrams) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Notifications({ notifications, setNotifications }) {
  const handleDismiss = (id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Notifications</h1>
      <nav className="mb-6">
        <Link to="/" className="text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </nav>

      {notifications.length === 0 ? (
        <p className="text-center text-gray-500">No notifications yet.</p>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div key={notification.id} className="bg-white p-4 rounded shadow">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">{notification.title}</h2>
                  <p className="text-gray-600">{new Date(notification.timestamp).toLocaleString()}</p>
                  <p className="mt-2">{notification.body}</p>
                </div>
                <button
                  onClick={() => handleDismiss(notification.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FoodJournal = memo(({ entries, setEntries }) => {
  const [foodInput, setFoodInput] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);

  const [entryDate, setEntryDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
  });

  const [entryTime, setEntryTime] = useState(() => {
    const now = new Date();
    const formattedTime = now.toTimeString().split(" ")[0].slice(0, 5);
    return formattedTime;
  });

  const [errorMessage, setErrorMessage] = useState("");
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const maxDate = `${year}-${month}-${day}`;

  const handleDateChange = (e) => {
    const selected = new Date(e.target.value);
    const todayDate = new Date(maxDate);
    if (selected > todayDate) {
      setEntryDate(maxDate);
    } else {
      setEntryDate(e.target.value);
    }
  };

  const handleSearch = async () => {
    if (!foodInput.trim()) {
      return;
    }
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/search-foods`,
        {
          params: { query: foodInput },
        }
      );
      const foods = response.data.foods?.food || [];
      setSearchResults(foods);
    } catch (error) {
      console.error("FoodJournal: Error searching foods:", error.response?.data || error.message);
    }
  };

  const handleSelectFood = (food) => {
    const selectedDateTime = new Date(`${entryDate}T${entryTime}:00`);
    const now = new Date();

    const todayDate = new Date(maxDate);
    const selectedDate = new Date(entryDate);
    if (selectedDate > todayDate) {
      setErrorMessage("Cannot log a future date. Please select a date up to today.");
      setEntryDate(maxDate);
      return;
    }

    if (entryDate === maxDate && selectedDateTime > now) {
      setErrorMessage("Cannot log a future time for today. Please select a time up to the current moment.");
      return;
    }

    setErrorMessage("");

    const [hours, minutes] = entryTime.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12;
    const formattedTime = `${formattedHours}:${minutes.toString().padStart(2, "0")}:00 ${period}`;

    setEntries([
      ...entries,
      {
        time: formattedTime,
        date: entryDate,
        food: food.food_name,
        macros: {
          protein: food.food_description.includes("Protein")
            ? parseFloat(food.food_description.match(/Protein: (\d+\.?\d*)/)?.[1] || 0)
            : 0,
          carbs: food.food_description.includes("Carbs")
            ? parseFloat(food.food_description.match(/Carbs: (\d+\.?\d*)/)?.[1] || 0)
            : 0,
          fat: food.food_description.includes("Fat")
            ? parseFloat(food.food_description.match(/Fat: (\d+\.?\d*)/)?.[1] || 0)
            : 0,
        },
      },
    ]);
    localStorage.removeItem("lastSnackReminder");
    setSelectedFood(food);
    setSearchResults([]);
    setFoodInput("");

    const newToday = new Date();
    const newYear = newToday.getFullYear();
    const newMonth = String(newToday.getMonth() + 1).padStart(2, "0");
    const newDay = String(newToday.getDate()).padStart(2, "0");
    setEntryDate(`${newYear}-${newMonth}-${newDay}`);
    setEntryTime(newToday.toTimeString().split(" ")[0].slice(0, 5));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Food Journal</h1>
      <nav className="mb-6">
        <Link to="/" className="text-blue-500 hover:underline">
          Back to Dashboard
        </Link>
      </nav>

      <div className="mb-4 flex flex-col space-y-2">
        <div className="flex space-x-2">
          <input
            type="text"
            value={foodInput}
            onChange={(e) => setFoodInput(e.target.value)}
            placeholder="Search for a food (e.g., apple)"
            className="border p-2 rounded w-full max-w-md"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Search
          </button>
        </div>
        <div className="flex space-x-2">
          <div>
            <label className="block text-sm font-medium mb-1">Date:</label>
            <input
              type="date"
              value={entryDate}
              onChange={handleDateChange}
              max={maxDate}
              className="border p-2 rounded w-full max-w-[150px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time:</label>
            <input
              type="time"
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              className="border p-2 rounded w-full max-w-[100px]"
            />
          </div>
        </div>
        {errorMessage && (
          <div className="text-red-500 text-sm mt-2">
            {errorMessage}
          </div>
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="mb-4">
          <h2 className="text-lg font-medium mb-2">Search Results:</h2>
          <ul className="space-y-2">
            {searchResults.map((food) => (
              <li
                key={food.food_id}
                className="border p-3 rounded bg-white cursor-pointer hover:bg-gray-100"
                onClick={() => handleSelectFood(food)}
              >
                {food.food_name} - {food.food_description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div key={index} className="border p-3 rounded bg-white">
            <p>
              {entry.date} {entry.time} - {entry.food} (P: {entry.macros.protein}g, C: {entry.macros.carbs}g, F: {entry.macros.fat}g)
            </p>
          </div>
        ))}
      </div>
    </div>
  );
});

function App() {
  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem("macroEntries");
    return saved ? JSON.parse(saved) : [];
  });
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [proteinPercent, setProteinPercent] = useState(35);
  const [fatPercent, setFatPercent] = useState(30);
  const [carbPercent, setCarbPercent] = useState(35);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [lastSnackReminder, setLastSnackReminder] = useState(() => {
    const saved = localStorage.getItem("lastSnackReminder");
    return saved ? parseInt(saved, 10) : null;
  });
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem("notifications");
    return saved ? JSON.parse(saved) : [];
  });

  const today = new Date().toLocaleDateString("en-CA");
  const todayEntries = entries.filter((entry) => entry.date === today);
  const currentProtein = todayEntries.reduce((sum, entry) => sum + (entry.macros?.protein || 0), 0);
  const currentFat = todayEntries.reduce((sum, entry) => sum + (entry.macros?.fat || 0), 0);
  const currentCarbs = todayEntries.reduce((sum, entry) => sum + (entry.macros?.carbs || 0), 0);
  const proteinGrams = ((proteinPercent / 100) * calorieGoal) / 4;
  const fatGrams = ((fatPercent / 100) * calorieGoal) / 9;
  const carbGrams = ((carbPercent / 100) * calorieGoal) / 4;
  const uniqueDays = [...new Set(entries.map((entry) => entry.date))];
  const hasEnoughData = uniqueDays.length >= 5;

  const handleSetEntries = useCallback((newEntries) => {
    setEntries(newEntries);
  }, []);

  useEffect(() => {
    console.log("App: Checking Notification API support...");
    if (typeof Notification === "undefined") {
      console.warn("Notification API is not supported in this browser.");
      setNotificationPermission("denied");
      return;
    }

    console.log("App: Notification API supported. Current permission:", Notification.permission);
    if (Notification.permission === "default" || Notification.permission === "denied") {
      console.log("App: Requesting notification permission...");
      Notification.requestPermission().then((permission) => {
        console.log("App: Notification permission result:", permission);
        setNotificationPermission(permission);
      }).catch((error) => {
        console.error("App: Error requesting notification permission:", error);
      });
    } else {
      console.log("App: Notification permission already granted.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("macroEntries", JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    console.log("App: Notification Permission:", notificationPermission);
    if (notificationPermission !== "granted") return;
    if (!hasEnoughData) {
      console.log("App: Learning period not complete yet. Days logged:", uniqueDays.length);
      return;
    }

    const checkSnackTime = async () => {
      console.log("App: Checking snack time...");
      console.log("App: Today’s entries:", todayEntries);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentEntries = entries.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= thirtyDaysAgo;
      });

      const allTimes = recentEntries
        .map((entry) => {
          const [time, period] = entry.time.split(" ");
          let [hours, minutes] = time.split(":").map(Number);
          if (period === "PM" && hours !== 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          return hours * 60 + minutes;
        })
        .sort((a, b) => a - b);

      const gaps = [];
      for (let i = 1; i < allTimes.length; i++) {
        gaps.push(allTimes[i] - allTimes[i - 1]);
      }
      const avgGap = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 180;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const todayTimes = todayEntries
        .map((entry) => {
          const [time, period] = entry.time.split(" ");
          let [hours, minutes] = time.split(":").map(Number);
          if (period === "PM" && hours !== 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          return hours * 60 + minutes;
        })
        .sort((a, b) => a - b);
      const lastMealTime = todayTimes.length > 0 ? todayTimes[todayTimes.length - 1] : -Infinity;

      console.log("App: Recent meal times (last 30 days):", allTimes);
      console.log("App: Average gap (last 30 days):", avgGap);
      console.log("App: Today’s times:", todayTimes);
      console.log("App: Last meal time:", lastMealTime);
      console.log("App: Current minutes:", currentMinutes);
      console.log("App: Time since last meal:", currentMinutes - lastMealTime);

      const lastMealTimestamp = todayEntries.length > 0 ? new Date(`${todayEntries[todayEntries.length - 1].date} ${todayEntries[todayEntries.length - 1].time}`).getTime() : 0;
      if (lastSnackReminder && lastSnackReminder > lastMealTimestamp) {
        console.log("App: Already sent a snack reminder for this meal gap.");
        return;
      }

      if (currentMinutes - lastMealTime > avgGap) {
        console.log("App: Triggering snack notification...");
        const prompt = `Suggest a quick snack to help meet macro goals. Keep it positive and concise. Current intake: Protein ${currentProtein}g/${proteinGrams}g, Fat ${currentFat}g/${fatGrams}g, Carbs ${currentCarbs}g/${carbGrams}g. Analyze the user's eating habits over the last 30 days to identify patterns and preferences (e.g., frequently eaten foods, avoided foods, typical meal times). Here are the recent entries: ${JSON.stringify(recentEntries)}. Suggest a snack that aligns with their eating habits and helps meet their macro goals.`;
        try {
          console.log("App: Calling /claude-snack with prompt:", prompt);
          const response = await axios.post(
            `${import.meta.env.VITE_BACKEND_URL}/claude-snack`,
            { prompt },
            { headers: { "Content-Type": "application/json" } }
          );
          console.log("App: Snack suggestion response:", response.data);
          const snackSuggestion = response.data.text;
          try {
            new Notification("Snack Time! 🍎", {
              body: `It’s ${now.toLocaleTimeString()}—time for a snack? ${snackSuggestion}`,
            });
            console.log("App: Notification sent successfully!");
            const nowTimestamp = now.getTime();
            const newNotification = {
              id: nowTimestamp,
              title: "Snack Time! 🍎",
              body: `It’s ${now.toLocaleTimeString()}—time for a snack? ${snackSuggestion}`,
              timestamp: nowTimestamp,
              read: false,
            };
            setNotifications((prev) => [...prev, newNotification]);
            setLastSnackReminder(nowTimestamp);
            localStorage.setItem("lastSnackReminder", nowTimestamp.toString());
          } catch (error) {
            console.error("App: Notification Error:", error);
          }
        } catch (error) {
          console.error("App: Snack Suggestion Error:", error);
        }
      } else {
        console.log("App: Not time for a snack yet.");
      }
    };

    const interval = setInterval(checkSnackTime, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [notificationPermission, entries, calorieGoal, proteinPercent, fatPercent, carbPercent, hasEnoughData, setNotifications]);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              entries={entries}
              calorieGoal={calorieGoal}
              setCalorieGoal={setCalorieGoal}
              proteinPercent={proteinPercent}
              setProteinPercent={setProteinPercent}
              fatPercent={fatPercent}
              setFatPercent={setFatPercent}
              carbPercent={carbPercent}
              setCarbPercent={setCarbPercent}
              notificationPermission={notificationPermission}
              notifications={notifications}
              setNotifications={setNotifications}
            />
          }
        />
        <Route path="/journal" element={<FoodJournal entries={entries} setEntries={handleSetEntries} />} />
        <Route path="/notifications" element={<Notifications notifications={notifications} setNotifications={setNotifications} />} />
      </Routes>
    </Router>
  );
}

export default App;