import React from 'react';
// Import social icons from react-icons/fa6
import { FaLinkedinIn, FaGithub, FaInstagram } from 'react-icons/fa6';

function Footer() {
  const currentYear = new Date().getFullYear(); // Dynamically get the current year

  return (
    <>
      {/* Footer Container with the same gradient background */}
      {/* min-h-[100px] ensures a minimum height for the footer */}
      <div className="bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 py-6 mt-20">
        <div className="max-w-screen-2xl mx-auto container px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Copyright Information */}
          <p className="text-center sm:text-left text-sm text-gray-800 flex-1 sm:border-l sm:border-gray-400 sm:pl-4">
            Copyright © {currentYear} - All rights reserved by Manmaya Rama
          </p>

          {/* Social Icons */}
          <div className="flex gap-4 mt-4 sm:mt-0"> {/* Gap between icons, margin-top for mobile */}
            {/* LinkedIn Icon */}
            <a
              href="https://linkedin.com/in/manmaya-rama"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-blue-700 transition-colors duration-300" // Icon color and hover effect
            >
              <FaLinkedinIn className="text-2xl" /> {/* Adjust size as needed */}
            </a>
            {/* GitHub Icon */}
            <a
              href="https://github.com/manmayarama"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-900 transition-colors duration-300" // Icon color and hover effect
            >
              <FaGithub className="text-2xl" /> {/* Adjust size as needed */}
            </a>
            {/* Instagram Icon */}
            <a
              href="https://www.instagram.com/i_a_m_manu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-pink-600 transition-colors duration-300" // Icon color and hover effect
            >
              <FaInstagram className="text-2xl" /> {/* Adjust size as needed */}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default Footer;