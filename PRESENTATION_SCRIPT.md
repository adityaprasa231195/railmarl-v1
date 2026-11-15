# RAILMARL: Major Project Presentation Script

**Project Title:** RAILMARL — Intelligent Platform Management & Railway Traffic Control System for Itarsi Junction (ET)  
**Team Format:** 4 Students  
**Duration:** ~8 to 10 minutes total (~2 minutes per student)

---

## Presentation Roles Breakdown

| Student | Section Title | Primary Focus | Pages to Demonstrate |
| :--- | :--- | :--- | :--- |
| **Student 1** | Problem Statement & Station Infrastructure | Real-world junction bottlenecks, track geometry, and capacity limits | Overview Dashboard & Platform Management |
| **Student 2** | Smart Allocation & Safety Rules | Deterministic rule engine, coach length checks, and headway buffers | Smart Platform Allocation |
| **Student 3** | Machine Learning Clearance Predictor | Dwell time forecasting, DecisionTree model, and buffer alerts | ML Insights & Live Inference Engine |
| **Student 4** | Traffic Control, External API, & Architecture | Priority queue, API telemetry, offline resilience, and deployment | Traffic Management & Settings |

---

## Spoken Presentation Script

### Student 1: The Station Problem & System Overview

> "Good morning, Professor.
> 
> Our major project is called **RAILMARL**. It is an automated platform allocation and railway traffic management system designed specifically for **Itarsi Junction** in Madhya Pradesh.
> 
> As you know, Itarsi is one of the busiest junction stations in the Indian Railways network. It connects the North-South and East-West railway corridors. With over a hundred express trains, freight rakes, and passenger shuttles passing through daily, manual platform dispatching often leads to outer signal waiting, congestion, and unexpected platform clashes.
> 
> To solve this, we built a full-stack automated platform manager.
> 
> *(Open the Overview Dashboard & Platform Management screen)*
> 
> Here on our main dashboard, you can see the real-time status of all 8 platforms at Itarsi. We modeled physical track lengths, coach capacities from 14 to 24 coaches, and track categories including Main lines, Through lines, and Bay platforms. 
> 
> When trains approach, the system tracks whether each platform is Available, Occupied, or Reserved.
> 
> Now, my teammate will explain how our smart engine decides which train gets which platform."

---

### Student 2: Smart Allocation & Physical Safety Rules

> "Thank you.
> 
> When a train approaches Itarsi, assigning a platform cannot be random. It has to follow strict railway safety constraints.
> 
> *(Open the Smart Platform Allocation page)*
> 
> In our Smart Allocation engine, we implemented a deterministic rule-based scoring system:
> 
> 1. **Length Check:** If a train has 24 coaches, the engine will never send it to a platform that only fits 18 coaches. That prevents rake overhang and signal blockage.
> 2. **Track Matching:** Fast through-trains are prioritized for main lines, while short shuttle trains are routed to bay platforms.
> 3. **The 15-Minute Safety Buffer:** Our algorithm enforces a mandatory 15-minute gap between one train departing and the next train arriving on the same track.
> 
> In our engineering design, **physical safety rules always override machine learning.** If an AI suggests a platform that causes a length violation or double-booking, the rule engine immediately blocks it.
> 
> But real trains rarely leave exactly on time. Next, my teammate will explain how we used Machine Learning to predict realistic platform clearance times."

---

### Student 3: Machine Learning Platform Clearance Predictor

> "Thank you.
> 
> The biggest challenge station masters face is timetable variance. A train scheduled for a 15-minute halt might take 22 minutes because of passenger rush, parcel loading, or a locomotive crew change.
> 
> *(Open the ML Insights page)*
> 
> In Stages 6 and 8 of our project, we built a platform dwell-time prediction model using Scikit-Learn.
> 
> We tested both Random Forest and Decision Tree Regressors trained on historical occupancy logs. 
> 
> To ensure scientific validity, our model follows a **Zero Future Leakage** rule:
> - The model only takes inputs available at dispatch time: train category, arrival hour, day of the week, coach count, and scheduled dwell.
> - It never uses actual departure time or future information as an input.
> 
> **How this helps the station master:**
> When train 12627 Karnataka Express arrives, our model predicts it will occupy the platform for 18 minutes instead of the scheduled 15 minutes. It then computes the exact estimated clearance time in 12-hour AM/PM format (for example, `10:48 AM`).
> 
> If that delay encroaches on the safety buffer of the next scheduled train, our system raises a visual warning so the controller can reassign the upcoming train before a track jam occurs.
> 
> Now, my teammate will show our live traffic monitoring dashboard and system deployment."

---

### Student 4: Traffic Management, External API, & System Architecture

> "Thank you.
> 
> In Stage 9, we expanded the system into full station traffic management.
> 
> *(Open the Traffic Management page)*
> 
> Here you can see:
> 1. **Live Traffic Board:** A real-time arrivals and departures board that tracks delay minutes (+12m, +45m) and running status.
> 2. **Priority Queue:** When multiple trains wait for a platform, our system scores them from 0 to 100 based on category priority (Superfast > Express > Passenger > Freight) and delay mitigation urgency.
> 3. **24-Hour Congestion Analytics:** A density chart that highlights peak transit periods at Itarsi Junction.
> 
> **External API Integration & Offline Fallback:**
> We integrated live Indian Railway REST APIs (RapidAPI and RailRadar). But because internet connections or external servers can fail, we built an automatic offline demonstration adapter. If external calls hit a rate limit or drop, the station system continues running seamlessly with local Itarsi demonstration schedules.
> 
> **Architecture & Testing:**
> - **Backend:** Python FastAPI with an SQLite database and SQLAlchemy ORM.
> - **Frontend:** React 19 with Vite, TypeScript, and Tailwind CSS.
> - **Testing:** We wrote 83 automated test cases in pytest covering every calculation, rejection guard, and ML endpoint.
> - **Live Deployment:** Our backend is deployed live on Render, and our repository is maintained on GitHub.
> 
> That concludes our presentation. We would be happy to take any questions."

---

## Teacher / Evaluator Q&A Cheat Sheet

### 1. Why didn't you use pure Deep Reinforcement Learning for platform dispatching?
> "In passenger railways, safety rules like physical track length, electrification, and interlocking clearances must be deterministic and provable. Pure RL can act as a black box and make non-compliant recommendations under unseen states. We used a deterministic rule engine for safety-critical allocation and applied Machine Learning where uncertainty actually exists: platform dwell time duration."

### 2. What happens if the external Indian Railways API is down or rate-limited?
> "We implemented an adapter pattern with an automatic offline fallback. If an API times out or returns HTTP 429 (rate limited), the backend smoothly serves verified demonstration schedules for Itarsi Junction from cache and local records. The station master dashboard never crashes."

### 3. How does your ML model prevent data leakage?
> "The model only trains on completed historical runs. At prediction time, it only receives features available before berthing: scheduled arrival, scheduled dwell, train category, day of week, time of day, and coach count. Actual departure time and actual clearance time are strictly excluded from the feature matrix."

### 4. What are the key evaluation metrics of the model?
> "We evaluate using Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE) against a holdout test split. Our decision tree model achieved an MAE of ~5.6 minutes on historical dwell predictions."

### 5. How are trains prioritized in the queue?
> "Using a 0 to 100 point multi-factor formula:
> - Category Weight: Superfast (35 pts), Express (25 pts), Passenger (15 pts), Freight (10 pts)
> - Delay Mitigation: Up to +25 points for trains running behind schedule to prevent cascading delay
> - Arrival Proximity: Priority for trains arriving within short headway intervals
> - Heavy Rakes: +10 points for trains with 22 or more coaches."
