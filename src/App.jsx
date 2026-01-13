"use client";

import { useState, useEffect, useRef } from "react";
import QrScanner from "qr-scanner";
import axios from "axios";

// Add this at the top of your component, after the imports
const scrollbarStyles = `
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(245, 240, 225, 0.5);
    border-radius: 10px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #7AE2CF;
    border-radius: 10px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #5ECFBC;
  }
`;

export default function AttendanceScanner() {
  const [scanResult, setScanResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [maxZoom, setMaxZoom] = useState(5);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [students, setStudents] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isFetchingCookies, setIsFetchingCookies] = useState(false);
  const [cookieUpdateResults, setCookieUpdateResults] = useState(null);
  const videoRef = useRef(null);
  const qrScannerRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch students from API
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setIsLoadingStudents(true);
        const response = await axios.get(
          "https://g1-proxy-backend.vercel.app/api/students"
        );
        if (response.data.success && response.data.data) {
          // Map the API response to match the expected format
          const formattedStudents = response.data.data.map((student) => ({
            name: student.student_name,
            stu_id: student.studid,
            cookie: student.cookies,
          }));
          setStudents(formattedStudents);
        } else {
          console.error("Failed to fetch students:", response.data);
          setError("Failed to load student data");
        }
      } catch (err) {
        console.error("Error fetching students:", err);
        setError(`Error loading students: ${err.message}`);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    fetchStudents();
  }, []);

  // Function to fetch and update cookies
  const fetchAndUpdateCookies = async () => {
    try {
      setIsFetchingCookies(true);
      setCookieUpdateResults(null);
      setError(null);

      const response = await axios.get(
        "https://g1-proxy-backend.vercel.app/api/fetch-cookies"
      );

      if (response.data.success) {
        setCookieUpdateResults(response.data);

        // Refresh student data after cookies are updated
        const studentsResponse = await axios.get(
          "https://g1-proxy-backend.vercel.app/api/students"
        );
        if (studentsResponse.data.success && studentsResponse.data.data) {
          const formattedStudents = studentsResponse.data.data.map(
            (student) => ({
              name: student.student_name,
              stu_id: student.studid,
              cookie: student.cookies,
            })
          );
          setStudents(formattedStudents);
        }
      } else {
        setError("Failed to update cookies");
      }
    } catch (err) {
      console.error("Error updating cookies:", err);
      setError(`Error updating cookies: ${err.message}`);
    } finally {
      setIsFetchingCookies(false);
    }
  };

  // Function to fetch available cameras
  const fetchCameras = async () => {
    try {
      // Request permission to access media devices
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop()); // Stop the stream immediately
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      setCameras(videoDevices);
      // Select the first back camera by default, if available
      const backCamera = videoDevices.find(
        (device) =>
          device.label.toLowerCase().includes("back") ||
          device.label.toLowerCase().includes("rear") ||
          device.label.toLowerCase().includes("wide") ||
          device.label.toLowerCase().includes("ultra") ||
          device.label.toLowerCase().includes("macro")
      );
      setSelectedCamera(backCamera || videoDevices[0] || null);
    } catch (err) {
      console.error("Error fetching cameras:", err);
      setError("Could not access cameras. Please check permissions.");
    }
  };

  // Fetch cameras on component mount
  useEffect(() => {
    fetchCameras();
  }, []);

  // Function to submit attendance data using new backend format
  const submitAttendance = async (attendanceId) => {
    if (!attendanceId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Make a single API call - backend now handles all students
      const response = await axios.post(
        "https://g1-proxy-backend.vercel.app/submit-attendance",
        {
          attendance_id: attendanceId,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 30000, // Increased timeout for concurrent requests
        }
      );

      // Handle the new response format
      if (response.data.success && response.data.results) {
        // Sort results alphabetically by name
        const sortedResults = response.data.results.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        setResults({
          attendance_id: response.data.attendance_id,
          stats: response.data.stats,
          results: sortedResults,
        });
      } else {
        setError("Invalid response format from server");
      }
    } catch (err) {
      console.error("Error in attendance submission:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to apply zoom
  const applyZoom = async () => {
    try {
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities();
          if (capabilities.zoom) {
            setZoomSupported(true);
            setMaxZoom(capabilities.zoom.max || 5);
            await videoTrack.applyConstraints({
              advanced: [{ zoom: zoomLevel }],
            });
          } else {
            setZoomSupported(false);
          }
        }
      }
    } catch (err) {
      console.error("Error applying zoom:", err);
    }
  };

  // Initialize scanner
  const initializeScanner = async () => {
    try {
      // Check if videoRef.current exists first
      if (!videoRef.current) {
        console.error("Video element not found");
        setError(
          "Video element not found. Please refresh the page and try again."
        );
        setScannerActive(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCamera
            ? { exact: selectedCamera.deviceId }
            : undefined,
          facingMode: !selectedCamera ? "environment" : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      // Check zoom capabilities
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities();
        setZoomSupported(!!capabilities.zoom);
        setMaxZoom(capabilities.zoom?.max || 5);
      }

      // Initialize qr-scanner
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          scanner.stop();
          stream.getTracks().forEach((track) => track.stop());
          setScanResult(result.data);
          setScannerActive(false);
          submitAttendance(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 10,
        }
      );

      qrScannerRef.current = scanner;
      await scanner.start();
    } catch (err) {
      console.error("Error initializing scanner:", err);
      setError("Could not access camera. Please check permissions.");
      setScannerActive(false);
    }
  };

  // Function to handle QR code scanning from uploaded image
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
      });
      setScanResult(result.data);
      submitAttendance(result.data);
    } catch (err) {
      console.error("Error scanning QR code from image:", err);
      setError("Could not scan QR code from the uploaded image.");
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Effect to apply zoom
  useEffect(() => {
    if (scannerActive && zoomSupported) {
      applyZoom();
    }
  }, [zoomLevel, scannerActive, zoomSupported]);

  // Effect to manage scanner lifecycle
  useEffect(() => {
    if (scannerActive) {
      initializeScanner();
    }

    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [scannerActive, selectedCamera]);

  const startScanner = () => {
    if (!selectedCamera) {
      setError("No camera selected. Please select a camera.");
      return;
    }
    setScannerActive(true);
  };

  const resetScanner = () => {
    setScanResult(null);
    setResults(null);
    setError(null);
    setScannerActive(false);
  };

  // Helper function to render status indicators
  const renderStatusIndicator = (result) => {
    // Check for ATTENDANCE_NOT_VALID status
    if (result.status === "ATTENDANCE_NOT_VALID") {
      return (
        <div className="flex items-center space-x-2 text-red-600">
          <svg
            className="h-5 w-5 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-red-600 font-medium">
            Attendance Not Valid
          </p>
        </div>
      );
    }
    // Check if status exists and is a success status
    else if (result.status && !result.error) {
      return (
        <div className="flex items-center space-x-2">
          <svg
            className="h-5 w-5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <p className="text-sm text-green-600 font-medium">{result.status}</p>
        </div>
      );
    } else if (result.error) {
      // Check for specific error messages
      const errorMsg = result.error;
      const isAlreadyRecorded = errorMsg.includes(
        "ATTENDANCE_RECORDED_ALREADY"
      );
      const isNotValid = errorMsg.includes("ATTENDANCE_NOT_VALID");

      // Set color based on error type
      const colorClass = isAlreadyRecorded ? "text-blue-600" : "text-red-600";
      const bgColorClass = isAlreadyRecorded ? "bg-blue-50" : "bg-red-50";

      return (
        <div className={`flex items-center space-x-2 ${colorClass}`}>
          <svg
            className={`h-5 w-5 ${colorClass}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className={`text-sm ${colorClass} font-medium`}>{errorMsg}</p>
        </div>
      );
    } else {
      return <p className="text-sm text-gray-600">Unknown status</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F0E1] to-[#E5E0D1] flex flex-col">
      <style>{scrollbarStyles}</style>
      <header className="bg-gradient-to-r from-[#006D77] to-[#001E26] text-white py-4 px-6 shadow-lg">
        <h1 className="text-2xl font-bold text-center tracking-wider">
          Attendance QR Scanner
        </h1>
      </header>

      <main className="flex-1 container mx-auto p-4 max-w-md">
        <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-lg rounded-xl shadow-lg p-6 mb-6 border border-[#7AE2CF]/30">
          {!scannerActive &&
            !scanResult &&
            !isSubmitting &&
            !results &&
            !error && (
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4 text-[#006D77]">
                  QR Code Scanner
                </h2>
                <p className="text-gray-600 mb-6">
                  Scan or upload an attendance QR code
                </p>
                {cameras.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#006D77] mb-2">
                      Select Camera
                    </label>
                    <select
                      value={selectedCamera?.deviceId || ""}
                      onChange={(e) => {
                        const selected = cameras.find(
                          (camera) => camera.deviceId === e.target.value
                        );
                        setSelectedCamera(selected);
                      }}
                      className="w-full p-2 border border-[#7AE2CF] rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#7AE2CF]"
                    >
                      {cameras.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label ||
                            `Camera ${cameras.indexOf(camera) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={startScanner}
                  className="bg-gradient-to-r from-[#7AE2CF] to-[#5ECFBC] hover:from-[#5ECFBC] hover:to-[#4DBCAA] text-[#001E26] font-medium py-3 px-6 rounded-lg w-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 mb-4"
                >
                  Start Camera Scanning
                </button>
                <div className="relative mb-4">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                    id="qr-upload"
                  />
                  <label
                    htmlFor="qr-upload"
                    className="bg-gradient-to-r from-[#006D77] to-[#005A64] hover:from-[#005A64] hover:to-[#004A54] text-white py-3 px-6 rounded-lg w-full transition-all duration-300 inline-block cursor-pointer shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    Upload QR Code Image
                  </label>
                </div>

                {/* New button for fetching and updating cookies */}
                <button
                  onClick={fetchAndUpdateCookies}
                  disabled={isFetchingCookies}
                  className="bg-gradient-to-r from-[#EE6C4D] to-[#E84A2F] hover:from-[#E84A2F] hover:to-[#D43A1F] text-white font-medium py-3 px-6 rounded-lg w-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFetchingCookies ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2"></div>
                      Updating Cookies...
                    </span>
                  ) : (
                    "Update All Cookies"
                  )}
                </button>
              </div>
            )}

          {/* Show loading state during submission */}
          {isSubmitting && (
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-t-4 border-b-4 border-[#006D77] rounded-full mx-auto mb-4"></div>
              <p className="text-lg text-[#006D77] font-medium">
                Submitting attendance for all students...
              </p>
              <p className="text-sm text-gray-600 mt-2">
                This may take a moment
              </p>
            </div>
          )}

          {/* Show error if any */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Display cookie update results */}
        {cookieUpdateResults && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 backdrop-filter backdrop-blur-lg bg-opacity-80 border border-[#7AE2CF]/30">
            <h2 className="text-xl font-semibold mb-4 text-center text-[#006D77]">
              Cookie Update Results
            </h2>
            <div className="mb-4 text-center">
              <p className="text-green-600 font-medium">
                {cookieUpdateResults.message}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Total Processed: {cookieUpdateResults.totalProcessed} |
                Successful: {cookieUpdateResults.successful} | Failed:{" "}
                {cookieUpdateResults.failed}
              </p>
            </div>
            <div className="space-y-4 mb-6 max-h-[480px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#7AE2CF] scrollbar-track-[#F5F0E1]/50">
              {cookieUpdateResults.results.map((result, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    result.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  } backdrop-blur-sm transition-all duration-300 hover:shadow-md`}
                >
                  <h3 className="font-semibold text-lg mb-2 text-[#006D77]">
                    {result.studentName}
                  </h3>
                  <p className="text-sm">
                    <span className="font-medium">Student ID:</span>{" "}
                    {result.studentId}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    {result.success ? (
                      <>
                        <svg
                          className="h-5 w-5 text-green-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <p className="text-sm text-green-600 font-medium">
                          {result.message}
                        </p>
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-5 w-5 text-red-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <p className="text-sm text-red-600 font-medium">
                          {result.error}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCookieUpdateResults(null)}
              className="bg-gradient-to-r from-[#7AE2CF] to-[#5ECFBC] hover:from-[#5ECFBC] hover:to-[#4DBCAA] text-[#001E26] font-medium py-3 px-6 rounded-lg w-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Close Results
            </button>
          </div>
        )}

        {scannerActive && (
          <div className="bg-white bg-opacity-90 backdrop-filter backdrop-blur-lg rounded-xl shadow-lg p-6 mb-6 border border-[#7AE2CF]/30">
            <h2 className="text-xl font-semibold mb-4 text-center text-[#006D77]">
              Scanning QR Code
            </h2>
            <div className="relative mb-4 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-lg"
                playsInline
                autoPlay
              ></video>
            </div>
            {zoomSupported && (
              <div className="mb-4 flex justify-center items-center">
                <div className="flex items-center space-x-2 w-full">
                  <span className="text-xs text-gray-500">1x</span>
                  <input
                    type="range"
                    min="1"
                    max={maxZoom}
                    step="0.1"
                    value={zoomLevel}
                    onChange={(e) =>
                      setZoomLevel(Number.parseFloat(e.target.value))
                    }
                    className="w-full accent-[#7AE2CF]"
                  />
                  <span className="text-xs text-gray-500">{maxZoom}x</span>
                </div>
              </div>
            )}
            <button
              onClick={() => setScannerActive(false)}
              className="bg-gradient-to-r from-[#EE6C4D] to-[#E84A2F] hover:from-[#E84A2F] hover:to-[#D43A1F] text-white font-medium py-3 px-6 rounded-lg w-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Cancel
            </button>
          </div>
        )}

        {results && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 backdrop-filter backdrop-blur-lg bg-opacity-80 border border-[#7AE2CF]/30">
            <h2 className="text-xl font-semibold mb-4 text-center text-[#006D77]">
              Attendance Results
            </h2>

            {/* Display statistics */}
            {results.stats && (
              <div className="mb-6 bg-gradient-to-r from-[#7AE2CF]/20 to-[#5ECFBC]/20 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-[#006D77]">
                      {results.stats.total}
                    </p>
                    <p className="text-xs text-gray-600">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {results.stats.successful}
                    </p>
                    <p className="text-xs text-gray-600">Successful</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {results.stats.failed}
                    </p>
                    <p className="text-xs text-gray-600">Failed</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 mb-6 max-h-[480px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#7AE2CF] scrollbar-track-[#F5F0E1]/50">
              {results.results.map((result, index) => {
                // Determine background color based on status and error
                let bgClass = "bg-gray-50 border-gray-200";

                // Check for ATTENDANCE_NOT_VALID status
                if (result.status === "ATTENDANCE_NOT_VALID") {
                  bgClass = "bg-red-50 border-red-200";
                } else if (result.status && !result.error) {
                  bgClass = "bg-green-50 border-green-200";
                } else if (result.error) {
                  const isAlreadyRecorded = result.error.includes(
                    "ATTENDANCE_RECORDED_ALREADY"
                  );
                  bgClass = isAlreadyRecorded
                    ? "bg-blue-50 border-blue-200"
                    : "bg-red-50 border-red-200";
                }

                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${bgClass} backdrop-blur-sm transition-all duration-300 hover:shadow-md`}
                  >
                    <h3 className="font-semibold text-lg mb-2 text-[#006D77]">
                      {result.name}
                    </h3>
                    <p className="text-sm mb-2">
                      <span className="font-medium">Student ID:</span>{" "}
                      {result.stu_id}
                    </p>
                    {renderStatusIndicator(result)}
                  </div>
                );
              })}
            </div>
            <button
              onClick={resetScanner}
              className="bg-gradient-to-r from-[#7AE2CF] to-[#5ECFBC] hover:from-[#5ECFBC] hover:to-[#4DBCAA] text-[#001E26] font-medium py-3 px-6 rounded-lg w-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Scan Another Code
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
